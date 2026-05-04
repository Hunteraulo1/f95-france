import {
	createApiKey,
	listApiKeysForAdmin,
	restoreRevokedApiKeyAdmin,
	revokeApiKeyForActor,
	updateApiKeyLimitsAdmin
} from '$lib/server/api-keys';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { error, fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'superadmin') {
		error(403, 'Accès réservé aux super-administrateurs.');
	}

	try {
		const [keys, usersList] = await Promise.all([
			listApiKeysForAdmin(),
			db
				.select({
					id: table.user.id,
					username: table.user.username,
					email: table.user.email
				})
				.from(table.user)
				.orderBy(table.user.username)
		]);

		return { keys, usersList };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		if (
			/api_key/i.test(msg) &&
			/does not exist|n'existe pas|undefined_table|owner_user_id|kind/i.test(msg)
		) {
			console.error('[api-management] tables manquantes — migrations Drizzle', err);
			error(
				503,
				'Tables « api_key » absentes ou schéma à jour requis : exécutez les migrations (pnpm db:push ou fichiers drizzle).'
			);
		}
		throw err;
	}
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'superadmin') {
			return fail(403, { message: 'Accès refusé.' });
		}

		const formData = await request.formData();
		const ownerUserId = String(formData.get('ownerUserId') ?? '').trim();
		if (!ownerUserId) {
			return fail(400, { message: 'Utilisateur propriétaire requis.' });
		}

		const [owner] = await db
			.select({ id: table.user.id })
			.from(table.user)
			.where(eq(table.user.id, ownerUserId))
			.limit(1);
		if (!owner) {
			return fail(400, { message: 'Utilisateur introuvable.' });
		}

		const label = String(formData.get('label') ?? '').trim() || 'Clé API';
		const rpmParsed = Number.parseInt(String(formData.get('requestsPerMinute') ?? '60'), 10);
		const requestsPerMinute = Number.isFinite(rpmParsed)
			? Math.min(10_000, Math.max(0, rpmParsed))
			: 60;

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
			ownerUserId,
			createdByUserId: locals.user.id
		});

		return { ok: true as const, createdKey: rawKey };
	},

	revoke: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'superadmin') {
			return fail(403, { message: 'Accès refusé.' });
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
			return fail(400, {
				message: 'Clé introuvable, déjà révoquée, ou entrée « session » non révocable.'
			});
		}

		return { ok: true as const, revoked: true };
	},

	restoreRevoked: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'superadmin') {
			return fail(403, { message: 'Accès refusé.' });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) {
			return fail(400, { message: 'Identifiant de clé manquant.' });
		}

		const ok = await restoreRevokedApiKeyAdmin(id);
		if (!ok) {
			return fail(400, {
				message: 'Clé introuvable, non révoquée, ou entrée « session » (non rétablissable ici).'
			});
		}

		return { ok: true as const, restored: true };
	},

	updateLimits: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'superadmin') {
			return fail(403, { message: 'Accès refusé.' });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) {
			return fail(400, { message: 'Identifiant de clé manquant.' });
		}

		const rpmParsed = Number.parseInt(String(formData.get('requestsPerMinute') ?? ''), 10);
		if (!Number.isFinite(rpmParsed) || rpmParsed < 0) {
			return fail(400, { message: 'Quota / minute invalide (entier ≥ 0).' });
		}
		const requestsPerMinute = Math.min(10_000, rpmParsed);

		const expiresRaw = String(formData.get('expiresAt') ?? '').trim();
		let expiresAt: Date | null = null;
		if (expiresRaw.length > 0) {
			const d = new Date(expiresRaw);
			if (Number.isNaN(d.getTime())) {
				return fail(400, { message: 'Date d’expiration invalide.' });
			}
			expiresAt = d;
		}

		const ok = await updateApiKeyLimitsAdmin(id, { requestsPerMinute, expiresAt });
		if (!ok) {
			return fail(400, { message: 'Clé introuvable, révoquée ou inchangée.' });
		}

		return { ok: true as const, updated: true };
	}
};
