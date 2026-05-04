import {
    countActiveApiKeysForOwner,
    createApiKey,
    listApiKeysForOwner,
    revokeApiKeyForActor,
    USER_API_KEY_DEFAULT_RPM,
    USER_API_KEY_MAX_COUNT,
    USER_API_KEY_MAX_RPM
} from '$lib/server/api-keys';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/dashboard/login');
	}

	try {
		const keys = await listApiKeysForOwner(locals.user.id);
		const activeCount = await countActiveApiKeysForOwner(locals.user.id);
		return {
			keys,
			activeCount,
			limits: {
				maxKeys: USER_API_KEY_MAX_COUNT,
				maxRpm: USER_API_KEY_MAX_RPM,
				defaultRpm: USER_API_KEY_DEFAULT_RPM
			}
		};
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		if (/api_key/i.test(msg) && /does not exist|n'existe pas|undefined_table|owner_user_id/i.test(msg)) {
			console.error('[api-keys] tables manquantes — migrations Drizzle', err);
			error(
				503,
				'Tables « api_key » absentes ou schéma à jour requis : exécutez les migrations (pnpm db:push ou drizzle/0005_api_key_owner.sql).'
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
		const rpmParsed = Number.parseInt(
			String(formData.get('requestsPerMinute') ?? String(USER_API_KEY_DEFAULT_RPM)),
			10
		);
		const requestsPerMinute = Number.isFinite(rpmParsed)
			? Math.min(USER_API_KEY_MAX_RPM, Math.max(1, rpmParsed))
			: USER_API_KEY_DEFAULT_RPM;

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
			requestsPerMinute,
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
			role: locals.user.role
		});
		if (!ok) {
			return fail(400, { message: 'Clé introuvable, déjà révoquée ou non autorisée.' });
		}

		return { ok: true as const, revoked: true };
	}
};
