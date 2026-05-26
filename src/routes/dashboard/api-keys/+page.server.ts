import {
	countActiveApiKeysForOwner,
	createApiKey,
	getSessionApiKeyRowForOwner,
	listApiKeysForOwner,
	revokeApiKeyForActor,
	USER_API_KEY_DEFAULT_RPM,
	USER_API_KEY_MAX_COUNT
} from '$lib/server/api-keys';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const REVOKED_FILTERS = ['all', 'revoked', 'not_revoked'] as const;
type RevokedFilter = (typeof REVOKED_FILTERS)[number];

function parseRevokedFilter(value: string | null): RevokedFilter {
	if (value && REVOKED_FILTERS.includes(value as RevokedFilter)) {
		return value as RevokedFilter;
	}
	return 'not_revoked';
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(302, '/dashboard/login');
	}

	const revokedFilter = parseRevokedFilter(url.searchParams.get('revoked'));

	try {
		const [allKeys, activeCount, sessionKey] = await Promise.all([
			listApiKeysForOwner(locals.user.id),
			countActiveApiKeysForOwner(locals.user.id),
			getSessionApiKeyRowForOwner(locals.user.id)
		]);
		const keys =
			revokedFilter === 'all'
				? allKeys
				: revokedFilter === 'revoked'
					? allKeys.filter((key) => key.revokedAt)
					: allKeys.filter((key) => !key.revokedAt);
		return {
			keys,
			revokedFilter,
			sessionKey,
			activeCount,
			limits: {
				maxKeys: USER_API_KEY_MAX_COUNT,
				defaultRpm: USER_API_KEY_DEFAULT_RPM
			}
		};
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		if (
			/api_key/i.test(msg) &&
			/does not exist|n'existe pas|undefined_table|owner_user_id|kind/i.test(msg)
		) {
			console.error('[api-keys] tables manquantes — migrations Drizzle', err);
			error(
				503,
				'Tables « api_key » absentes ou schéma à jour requis : exécutez les migrations (pnpm db:push ou drizzle/0006_api_key_kind.sql).'
			);
		}
		throw err;
	}
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { message: 'Non connecté.' });
		}

		const active = await countActiveApiKeysForOwner(locals.user.id);
		if (active >= USER_API_KEY_MAX_COUNT) {
			return fail(400, {
				message: `Nombre maximal de clés actives atteint (${USER_API_KEY_MAX_COUNT}). Révoquez une clé existante.`
			});
		}

		const formData = await request.formData();
		const label = String(formData.get('label') ?? '').trim() || 'Ma clé';

		const expiresRaw = String(formData.get('expiresAt') ?? '').trim();
		let expiresAt: Date | null = null;
		if (expiresRaw.length > 0) {
			const d = new Date(expiresRaw);
			if (Number.isNaN(d.getTime())) {
				return fail(400, { message: 'Date d’expiration invalide.' });
			}
			expiresAt = d;
		}

		const { rawKey } = await createApiKey({
			label,
			requestsPerMinute: USER_API_KEY_DEFAULT_RPM,
			expiresAt,
			ownerUserId: locals.user.id,
			createdByUserId: locals.user.id
		});

		return { ok: true as const, createdKey: rawKey };
	},

	revoke: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { message: 'Non connecté.' });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) {
			return fail(400, { message: 'Identifiant de clé manquant.' });
		}

		const ok = await revokeApiKeyForActor(id, {
			userId: locals.user.id,
			role: locals.user.role,
			permissions: locals.permissions
		});
		if (!ok) {
			return fail(400, { message: 'Clé introuvable, déjà révoquée ou non autorisée.' });
		}

		return { ok: true as const, revoked: true };
	},

	rotate: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { message: 'Non connecté.' });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) {
			return fail(400, { message: 'Identifiant de clé manquant.' });
		}

		const keys = await listApiKeysForOwner(locals.user.id);
		const target = keys.find((key) => key.id === id && !key.revokedAt);
		if (!target) {
			return fail(400, { message: 'Clé introuvable, déjà révoquée ou non autorisée.' });
		}

		const revoked = await revokeApiKeyForActor(id, {
			userId: locals.user.id,
			role: locals.user.role,
			permissions: locals.permissions
		});
		if (!revoked) {
			return fail(400, { message: 'Impossible de régénérer cette clé.' });
		}

		const { rawKey } = await createApiKey({
			label: target.label || 'Ma clé',
			requestsPerMinute: target.requestsPerMinute,
			expiresAt: target.expiresAt,
			ownerUserId: locals.user.id,
			createdByUserId: locals.user.id
		});

		return { ok: true as const, createdKey: rawKey, rotated: true };
	}
};
