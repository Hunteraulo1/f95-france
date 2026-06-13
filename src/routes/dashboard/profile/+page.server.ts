import { resolveProfileCustomizeFlags } from '$lib/permissions/profile-customize';
import {
	buildCustomProfileTheme,
	normalizeProfileBio,
	validateOptionalHttpUrl
} from '$lib/profile/custom-profile';
import { validateOptionalYoutubeMusicUrl } from '$lib/profile/youtube-music';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { hasPermission } from '$lib/server/permissions';
import { loadTranslatorPagesForUser } from '$lib/server/profile-translator';
import { getRoleEditMode } from '$lib/server/role-edit-mode';
import {
	handleTranslatorPagesUpdate,
	resolveTranslatorPagesWriteMode
} from '$lib/server/translator-pages-write';
import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

const userProfileSelect = {
	id: table.user.id,
	username: table.user.username,
	avatar: table.user.avatar,
	profileBio: table.user.profileBio,
	profileBackgroundUrl: table.user.profileBackgroundUrl,
	profileMusicUrl: table.user.profileMusicUrl,
	profileCursorUrl: table.user.profileCursorUrl
} as const;

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/dashboard/account/login');
	}

	const userId = locals.user.id;
	const [row] = await db
		.select(userProfileSelect)
		.from(table.user)
		.where(eq(table.user.id, userId))
		.limit(1);

	if (!row) {
		throw redirect(303, '/dashboard/account/login');
	}

	const profileCustomize = resolveProfileCustomizeFlags(locals.user.role, locals.permissions);
	const hasGamesManage = hasPermission(locals, 'games.manage');
	const roleEditMode = hasGamesManage ? await getRoleEditMode(locals.user.role) : null;

	const { translator, links } = await loadTranslatorPagesForUser(userId);

	const translatorPagesWriteMode = translator
		? await resolveTranslatorPagesWriteMode({
				hasGamesManage,
				roleSlug: locals.user.role,
				userDirectMode: locals.user.directMode ?? true
			})
		: null;

	return {
		user: row,
		profileCustomize,
		customProfile: buildCustomProfileTheme(row),
		directMode: locals.user.directMode ?? true,
		roleEditMode,
		hasGamesManage,
		translatorPagesWriteMode,
		linkedTranslator: translator
			? {
					id: translator.id,
					name: translator.name,
					pages: links.map((p) => ({ name: p.label, link: p.url }))
				}
			: null
	};
};

export const actions: Actions = {
	updateProfile: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { message: 'Non authentifié' });
		}

		const formData = await request.formData();
		const username = String(formData.get('username') ?? '').trim();
		const avatar = String(formData.get('avatar') ?? '').trim();

		if (!username) {
			return fail(400, { message: "Le nom d'utilisateur est requis" });
		}

		try {
			await db
				.update(table.user)
				.set({
					username,
					avatar: avatar || '',
					updatedAt: new Date()
				})
				.where(eq(table.user.id, locals.user.id));

			return { success: true, message: 'Profil mis à jour avec succès' };
		} catch (error: unknown) {
			console.error('Erreur lors de la mise à jour du profil:', error);

			const mysqlError =
				error && typeof error === 'object' && 'cause' in error
					? (error.cause as { code?: string; errno?: number; sqlMessage?: string })
					: null;

			if (mysqlError && (mysqlError.code === 'ER_DUP_ENTRY' || mysqlError.errno === 1062)) {
				if (mysqlError.sqlMessage?.includes('username')) {
					return fail(409, { message: `Un utilisateur avec le nom « ${username} » existe déjà` });
				}
				return fail(409, { message: "Ce nom d'utilisateur existe déjà" });
			}

			return fail(500, { message: 'Erreur lors de la mise à jour du profil' });
		}
	},

	updateCustomProfile: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { message: 'Non authentifié' });
		}

		const flags = resolveProfileCustomizeFlags(locals.user.role, locals.permissions);
		if (!flags.any) {
			return fail(403, { message: 'Aucune permission de personnalisation du profil.' });
		}

		const [current] = await db
			.select(userProfileSelect)
			.from(table.user)
			.where(eq(table.user.id, locals.user.id))
			.limit(1);

		if (!current) {
			return fail(404, { message: 'Utilisateur introuvable' });
		}

		const formData = await request.formData();
		const formBio = normalizeProfileBio(String(formData.get('profileBio') ?? ''));
		const formBackgroundRaw = String(formData.get('profileBackgroundUrl') ?? '');
		const formMusicRaw = String(formData.get('profileMusicUrl') ?? '');
		const formCursorRaw = String(formData.get('profileCursorUrl') ?? '');

		const norm = (v: string | null | undefined) => (v ?? '').trim();

		if (!flags.bio && norm(formBio) !== norm(current.profileBio)) {
			return fail(403, { message: 'Permission « Profil — bio » requise.' });
		}

		if (!flags.background && norm(formBackgroundRaw) !== norm(current.profileBackgroundUrl)) {
			return fail(403, { message: 'Permission « Profil — image de fond » requise.' });
		}
		if (!flags.music && norm(formMusicRaw) !== norm(current.profileMusicUrl)) {
			return fail(403, { message: 'Permission « Profil — musique » requise.' });
		}
		if (!flags.cursor && norm(formCursorRaw) !== norm(current.profileCursorUrl)) {
			return fail(403, { message: 'Permission « Profil — curseur » requise.' });
		}

		let profileBio = current.profileBio;
		let profileBackgroundUrl = current.profileBackgroundUrl;
		let profileMusicUrl = current.profileMusicUrl;
		let profileCursorUrl = current.profileCursorUrl;

		if (flags.bio) {
			profileBio = formBio || null;
		}

		if (flags.background) {
			const background = validateOptionalHttpUrl(formBackgroundRaw, 'Image de fond');
			if (typeof background === 'object' && background && 'error' in background) {
				return fail(400, { message: background.error });
			}
			profileBackgroundUrl = background;
		}

		if (flags.music) {
			const music = validateOptionalYoutubeMusicUrl(formMusicRaw);
			if (typeof music === 'object' && music && 'error' in music) {
				return fail(400, { message: music.error });
			}
			profileMusicUrl = music;
		}

		if (flags.cursor) {
			const cursor = validateOptionalHttpUrl(formCursorRaw, 'Curseur');
			if (typeof cursor === 'object' && cursor && 'error' in cursor) {
				return fail(400, { message: cursor.error });
			}
			profileCursorUrl = cursor;
		}

		try {
			await db
				.update(table.user)
				.set({
					profileBio,
					profileBackgroundUrl,
					profileMusicUrl,
					profileCursorUrl,
					updatedAt: new Date()
				})
				.where(eq(table.user.id, locals.user.id));

			return { success: true, message: 'Profil personnalisé mis à jour.' };
		} catch (error: unknown) {
			console.error('Erreur mise à jour profil personnalisé:', error);
			return fail(500, { message: 'Erreur lors de la mise à jour du profil.' });
		}
	},

	requestTranslatorPagesUpdate: async (event) => {
		const hasGamesManage = hasPermission(event.locals, 'games.manage');
		const result = await handleTranslatorPagesUpdate(event, { hasGamesManage });
		if (!result.ok) {
			return fail(result.status, { message: result.message });
		}
		return { success: true, message: result.message, mode: result.mode };
	}
};
