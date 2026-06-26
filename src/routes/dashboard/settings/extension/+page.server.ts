import { assertDashboardAuthenticated } from '$lib/server/dashboard-auth';
import {
	createLinkCode,
	LINK_CODE_TTL_MS,
	listExtensionKeys,
	revokeExtensionKey
} from '$lib/server/extension-link';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const EXTENSION_STORE_URL = 'https://extension.f95france.site';

export const load: PageServerLoad = async ({ locals }) => {
	assertDashboardAuthenticated(locals);

	const keys = await listExtensionKeys(locals.user.id);

	return {
		extensionStoreUrl: EXTENSION_STORE_URL,
		linkCodeTtlMinutes: Math.round(LINK_CODE_TTL_MS / 60000),
		devices: keys.map((key) => ({
			id: key.id,
			keyPrefix: key.keyPrefix,
			createdAt: key.createdAt,
			lastUsedAt: key.lastUsedAt
		}))
	};
};

export const actions: Actions = {
	generateCode: async ({ locals }) => {
		if (!locals.user) {
			return fail(401, { message: 'Non authentifié' });
		}

		try {
			const { code, expiresAt } = await createLinkCode(locals.user.id);
			return { ok: true as const, code, expiresAt: expiresAt.toISOString() };
		} catch (error: unknown) {
			console.error('Erreur lors de la génération du code de liaison:', error);
			return fail(500, { message: 'Erreur lors de la génération du code de liaison.' });
		}
	},

	revokeDevice: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { message: 'Non authentifié' });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) {
			return fail(400, { message: 'Identifiant d’appareil manquant.' });
		}

		const ok = await revokeExtensionKey(id, {
			userId: locals.user.id,
			role: locals.user.role,
			permissions: locals.permissions
		});
		if (!ok) {
			return fail(400, { message: 'Appareil introuvable ou déjà délié.' });
		}

		return { ok: true as const, revoked: true };
	}
};
