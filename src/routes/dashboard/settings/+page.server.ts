import { hasEffectivePermission } from '$lib/permissions/effective';
import * as auth from '$lib/server/auth';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { DEV_IMPERSONATION_ORIGIN_COOKIE } from '$lib/server/dev-impersonation';
import { userHasPermission } from '$lib/server/permissions';
import { assertPermission } from '$lib/server/permissions-guard';
import { getRoleEditMode } from '$lib/server/role-edit-mode';
import { fail } from '@sveltejs/kit';
import { and, eq, ne } from 'drizzle-orm';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, cookies }) => {
	// Vérifier que l'utilisateur est authentifié
	if (!locals.user) {
		throw new Error('Non authentifié');
	}

	const canImpersonateUsers = hasEffectivePermission(
		locals.user.role,
		locals.permissions,
		'dev.impersonate'
	);

	const devUsers = canImpersonateUsers
		? await db
				.select({
					id: table.user.id,
					username: table.user.username,
					role: table.user.role
				})
				.from(table.user)
		: [];

	const devOriginUserId = cookies.get(DEV_IMPERSONATION_ORIGIN_COOKIE);
	const canReturnToOwnAccount = Boolean(devOriginUserId);
	const [devOriginUser] =
		devOriginUserId && canReturnToOwnAccount
			? await db
					.select({ id: table.user.id, username: table.user.username, role: table.user.role })
					.from(table.user)
					.where(eq(table.user.id, devOriginUserId))
					.limit(1)
			: [];
	const passkeys = await db
		.select({
			id: table.passkey.id,
			createdAt: table.passkey.createdAt,
			lastUsedAt: table.passkey.lastUsedAt
		})
		.from(table.passkey)
		.where(eq(table.passkey.userId, locals.user.id));
	const [linkedTranslator] = await db
		.select({
			id: table.translator.id,
			name: table.translator.name,
			pages: table.translator.pages
		})
		.from(table.translator)
		.where(eq(table.translator.userId, locals.user.id))
		.limit(1);
	const roleEditMode = await getRoleEditMode(locals.user.role);

	return {
		user: locals.user,
		canEditDirectMode: roleEditMode === 'user_direct_mode',
		devUsers,
		passkeys,
		linkedTranslator: linkedTranslator
			? {
					id: linkedTranslator.id,
					name: linkedTranslator.name,
					pages: JSON.parse(linkedTranslator.pages || '[]') as Array<{ name: string; link: string }>
				}
			: null,
		canReturnToOwnAccount: Boolean(canReturnToOwnAccount && devOriginUser),
		devOriginUsername: devOriginUser?.username ?? null
	};
};

export const actions: Actions = {
	updateProfile: async ({ request, locals }) => {
		// Vérifier que l'utilisateur est authentifié
		if (!locals.user) {
			return fail(401, { message: 'Non authentifié' });
		}

		const formData = await request.formData();
		const username = formData.get('username') as string;
		const avatar = formData.get('avatar') as string;

		if (!username) {
			return fail(400, { message: "Le nom d'utilisateur est requis" });
		}

		try {
			await db
				.update(table.user)
				.set({
					username,
					avatar: avatar || ''
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
					return fail(409, { message: `Un utilisateur avec le nom "${username}" existe déjà` });
				}
				return fail(409, { message: "Ce nom d'utilisateur existe déjà" });
			}

			return fail(500, { message: 'Erreur lors de la mise à jour du profil' });
		}
	},

	updateTheme: async ({ request, locals }) => {
		// Vérifier que l'utilisateur est authentifié
		if (!locals.user) {
			return fail(401, { message: 'Non authentifié' });
		}

		const formData = await request.formData();
		const theme = formData.get('theme') as string;

		if (!theme || !['system', 'light', 'dark'].includes(theme)) {
			return fail(400, { message: 'Thème invalide' });
		}

		try {
			await db
				.update(table.user)
				.set({
					theme: theme as 'system' | 'light' | 'dark'
				})
				.where(eq(table.user.id, locals.user.id));

			return { success: true, message: 'Thème mis à jour avec succès' };
		} catch (error: unknown) {
			console.error('Erreur lors de la mise à jour du thème:', error);
			return fail(500, { message: 'Erreur lors de la mise à jour du thème' });
		}
	},

	unlinkDiscord: async ({ locals }) => {
		if (!locals.user) {
			return fail(401, { message: 'Non authentifié' });
		}

		try {
			await db.update(table.user).set({ discordId: null }).where(eq(table.user.id, locals.user.id));
			return { success: true, message: 'Compte Discord délié.' };
		} catch (error: unknown) {
			console.error('Erreur lors du délien Discord:', error);
			return fail(500, { message: 'Erreur lors du délien Discord.' });
		}
	},

	requestTranslatorPagesUpdate: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { message: 'Non authentifié' });
		}

		const formData = await request.formData();
		const translatorId = String(formData.get('translatorId') ?? '').trim();
		const pagesRaw = String(formData.get('pages') ?? '');
		if (!translatorId) {
			return fail(400, { message: 'Traducteur introuvable' });
		}

		let pagesParsed: Array<{ name: string; link: string }> = [];
		try {
			const raw = JSON.parse(pagesRaw) as Array<{ name?: string; link?: string }>;
			if (Array.isArray(raw)) {
				pagesParsed = raw.map((p) => ({
					name: String(p.name ?? '').trim(),
					link: String(p.link ?? '').trim()
				}));
			}
		} catch {
			return fail(400, { message: 'Format des pages invalide' });
		}
		if (pagesParsed.some((p) => !p.name || !p.link)) {
			return fail(400, { message: 'Chaque page doit avoir un nom et un lien.' });
		}

		const [translatorRow] = await db
			.select({
				id: table.translator.id,
				userId: table.translator.userId
			})
			.from(table.translator)
			.where(eq(table.translator.id, translatorId))
			.limit(1);

		if (!translatorRow || translatorRow.userId !== locals.user.id) {
			return fail(403, { message: 'Vous pouvez modifier uniquement votre profil traducteur lié.' });
		}

		await db.insert(table.submission).values({
			userId: locals.user.id,
			type: 'translator_pages',
			status: 'pending',
			data: JSON.stringify({
				translatorId,
				pages: pagesParsed
			})
		});

		return { success: true, message: 'Demande envoyée. Un admin doit la valider.' };
	},

	changePassword: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { message: 'Non authentifié' });
		}

		const formData = await request.formData();
		const currentPassword = String(formData.get('currentPassword') ?? '');
		const newPassword = String(formData.get('newPassword') ?? '');
		const confirmPassword = String(formData.get('confirmPassword') ?? '');

		if (!currentPassword || !newPassword || !confirmPassword) {
			return fail(400, { message: 'Tous les champs mot de passe sont requis.' });
		}

		if (newPassword.length < 8) {
			return fail(400, { message: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' });
		}

		if (newPassword !== confirmPassword) {
			return fail(400, { message: 'La confirmation ne correspond pas au nouveau mot de passe.' });
		}

		const [dbUser] = await db
			.select({
				id: table.user.id,
				passwordHash: table.user.passwordHash
			})
			.from(table.user)
			.where(eq(table.user.id, locals.user.id))
			.limit(1);

		if (!dbUser) {
			return fail(404, { message: 'Utilisateur introuvable.' });
		}

		const validCurrentPassword = auth.verifyPassword(currentPassword, dbUser.passwordHash);
		if (!validCurrentPassword) {
			return fail(400, { message: 'Le mot de passe actuel est incorrect.' });
		}

		const reusingSamePassword = auth.verifyPassword(newPassword, dbUser.passwordHash);
		if (reusingSamePassword) {
			return fail(400, { message: 'Le nouveau mot de passe doit être différent de l’actuel.' });
		}

		const nextHash = auth.hashPassword(newPassword);
		await db
			.update(table.user)
			.set({
				passwordHash: nextHash,
				updatedAt: new Date()
			})
			.where(eq(table.user.id, dbUser.id));

		// Bonnes pratiques: invalider les autres sessions actives du compte.
		if (locals.session?.id) {
			await db
				.delete(table.session)
				.where(and(eq(table.session.userId, dbUser.id), ne(table.session.id, locals.session.id)));
		}

		return { success: true, message: 'Mot de passe mis à jour avec succès.' };
	},

	updateDirectMode: async ({ request, locals, cookies }) => {
		if (!locals.user) {
			return fail(401, { message: 'Non authentifié' });
		}
		if (cookies.get(DEV_IMPERSONATION_ORIGIN_COOKIE)) {
			return fail(403, {
				message: 'Revenez sur votre compte pour modifier le mode direct.'
			});
		}
		const roleEditMode = await getRoleEditMode(locals.user.role);
		if (roleEditMode !== 'user_direct_mode') {
			return fail(403, {
				message:
					'Votre rôle n’utilise pas le mode direct personnel. Demandez à un administrateur de modifier le mode d’enregistrement du rôle.'
			});
		}

		const formData = await request.formData();
		const raw = String(formData.get('directMode') ?? 'false');
		const directMode = raw === 'true' || raw === 'on';

		try {
			await db
				.update(table.user)
				.set({
					directMode
				})
				.where(eq(table.user.id, locals.user.id));

			return { success: true, message: 'Mode direct mis à jour avec succès' };
		} catch (error: unknown) {
			console.error('Erreur lors de la mise à jour du mode direct:', error);
			return fail(500, { message: 'Erreur lors de la mise à jour du mode direct' });
		}
	},

	start2FASetup: async ({ locals }) => {
		if (!locals.user) {
			return fail(401, { message: 'Non authentifié' });
		}

		try {
			const secret = new OTPAuth.Secret();
			const totp = new OTPAuth.TOTP({
				issuer: 'F95 France',
				label: locals.user.username,
				algorithm: 'SHA1',
				digits: 6,
				period: 30,
				secret
			});
			const otpAuthUri = totp.toString();
			const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUri);
			const base32Secret = secret.base32;

			await db
				.update(table.user)
				.set({
					twoFactorSecret: base32Secret,
					twoFactorEnabled: false,
					updatedAt: new Date()
				})
				.where(eq(table.user.id, locals.user.id));

			return {
				success: true,
				message: 'Scannez le QR code et saisissez un code pour activer la 2FA.',
				twoFactorSetupPending: true,
				qrCodeDataUrl,
				manualEntryKey: base32Secret
			};
		} catch (error: unknown) {
			console.error("Erreur lors de l'initialisation de la 2FA:", error);
			return fail(500, { message: "Erreur lors de l'initialisation de la 2FA" });
		}
	},

	confirm2FASetup: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { message: 'Non authentifié' });
		}

		const formData = await request.formData();
		const code = String(formData.get('code') ?? '').trim();
		if (!/^\d{6}$/.test(code)) {
			return fail(400, { message: 'Code 2FA invalide (6 chiffres requis).' });
		}

		const [user] = await db
			.select({
				id: table.user.id,
				twoFactorSecret: table.user.twoFactorSecret
			})
			.from(table.user)
			.where(eq(table.user.id, locals.user.id))
			.limit(1);

		if (!user?.twoFactorSecret) {
			return fail(400, {
				message: "Aucune configuration 2FA en cours. Lancez d'abord l'activation."
			});
		}

		const totp = new OTPAuth.TOTP({
			issuer: 'F95 France',
			label: locals.user.username,
			algorithm: 'SHA1',
			digits: 6,
			period: 30,
			secret: OTPAuth.Secret.fromBase32(user.twoFactorSecret)
		});
		const delta = totp.validate({ token: code, window: 1 });
		if (delta === null) {
			return fail(400, { message: 'Code 2FA incorrect.' });
		}

		await db
			.update(table.user)
			.set({
				twoFactorEnabled: true,
				updatedAt: new Date()
			})
			.where(eq(table.user.id, locals.user.id));

		return {
			success: true,
			message: '2FA activée avec succès.',
			twoFactorSetupPending: false
		};
	},

	disable2FA: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { message: 'Non authentifié' });
		}

		const formData = await request.formData();
		const password = String(formData.get('password') ?? '');
		const code = String(formData.get('code') ?? '').trim();

		if (!password) {
			return fail(400, { message: 'Mot de passe requis.' });
		}
		if (!/^\d{6}$/.test(code)) {
			return fail(400, { message: 'Code 2FA invalide (6 chiffres requis).' });
		}

		const [user] = await db
			.select()
			.from(table.user)
			.where(eq(table.user.id, locals.user.id))
			.limit(1);
		if (!user) {
			return fail(404, { message: 'Utilisateur introuvable.' });
		}
		if (!user.twoFactorEnabled || !user.twoFactorSecret) {
			return fail(400, { message: "La 2FA n'est pas active." });
		}

		const validPassword = auth.verifyPassword(password, user.passwordHash);
		if (!validPassword) {
			return fail(400, { message: 'Mot de passe incorrect.' });
		}

		const totp = new OTPAuth.TOTP({
			issuer: 'F95 France',
			label: user.username,
			algorithm: 'SHA1',
			digits: 6,
			period: 30,
			secret: OTPAuth.Secret.fromBase32(user.twoFactorSecret)
		});
		const delta = totp.validate({ token: code, window: 1 });
		if (delta === null) {
			return fail(400, { message: 'Code 2FA incorrect.' });
		}

		await db
			.update(table.user)
			.set({
				twoFactorEnabled: false,
				twoFactorSecret: null,
				updatedAt: new Date()
			})
			.where(eq(table.user.id, locals.user.id));

		return { success: true, message: '2FA désactivée avec succès.', twoFactorSetupPending: false };
	},

	removePasskey: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { message: 'Non authentifié' });
		}
		const formData = await request.formData();
		const passkeyId = String(formData.get('passkeyId') ?? '').trim();
		if (!passkeyId) {
			return fail(400, { message: "Clé d'accès invalide." });
		}

		await db
			.delete(table.passkey)
			.where(and(eq(table.passkey.id, passkeyId), eq(table.passkey.userId, locals.user.id)));

		return { success: true, message: "Clé d'accès supprimée." };
	},

	switchDevUser: async ({ request, locals, cookies, url }) => {
		await assertPermission(locals, 'dev.impersonate');
		if (!locals.user) {
			return fail(401, { message: 'Non authentifié' });
		}
		if (!locals.session?.id) {
			return fail(401, { message: 'Session introuvable' });
		}

		const formData = await request.formData();
		const targetUserId = String(formData.get('targetUserId') ?? '').trim();
		if (!targetUserId) {
			return fail(400, { message: 'Utilisateur cible requis' });
		}

		const [targetUser] = await db
			.select({
				id: table.user.id,
				username: table.user.username
			})
			.from(table.user)
			.where(eq(table.user.id, targetUserId))
			.limit(1);

		if (!targetUser) {
			return fail(404, { message: 'Utilisateur introuvable' });
		}

		try {
			const existingOrigin = cookies.get(DEV_IMPERSONATION_ORIGIN_COOKIE);
			if (!existingOrigin) {
				cookies.set(DEV_IMPERSONATION_ORIGIN_COOKIE, locals.user.id, {
					path: '/',
					httpOnly: true,
					sameSite: 'lax',
					secure: url.protocol === 'https:',
					maxAge: 60 * 60 * 24 * 30
				});
			}

			await db
				.update(table.session)
				.set({ userId: targetUser.id })
				.where(eq(table.session.id, locals.session.id));

			return {
				success: true,
				message: `Session basculée vers ${targetUser.username}`
			};
		} catch (error: unknown) {
			console.error("Erreur lors du changement d'utilisateur (dev):", error);
			return fail(500, { message: "Erreur lors du changement d'utilisateur" });
		}
	},

	returnToOwnAccount: async ({ locals, cookies }) => {
		if (!locals.session?.id) {
			return fail(401, { message: 'Session introuvable' });
		}

		const originUserId = cookies.get(DEV_IMPERSONATION_ORIGIN_COOKIE);
		if (!originUserId) {
			return fail(400, { message: "Aucun compte d'origine à restaurer" });
		}

		const [originUser] = await db
			.select({ id: table.user.id, username: table.user.username, role: table.user.role })
			.from(table.user)
			.where(eq(table.user.id, originUserId))
			.limit(1);

		if (!originUser || !(await userHasPermission(originUser, 'dev.impersonate'))) {
			return fail(403, {
				message: "Le compte d'origine est invalide ou n'a pas le droit de changement d'utilisateur"
			});
		}

		try {
			await db
				.update(table.session)
				.set({ userId: originUser.id })
				.where(eq(table.session.id, locals.session.id));
			cookies.delete(DEV_IMPERSONATION_ORIGIN_COOKIE, { path: '/' });
			return { success: true, message: `Retour sur ${originUser.username}` };
		} catch (error: unknown) {
			console.error("Erreur lors du retour au compte d'origine:", error);
			return fail(500, { message: "Erreur lors du retour au compte d'origine" });
		}
	}
};
