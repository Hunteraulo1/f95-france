import * as auth from '$lib/server/auth';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import {
	assertDevImpersonationTargetAllowed,
	DEV_IMPERSONATION_ORIGIN_COOKIE,
	filterUsersForDevImpersonation,
	getDevImpersonationActorUser,
	returnToOwnAccount as returnToOwnAccountAction
} from '$lib/server/dev-impersonation';
import { assertPermission, hasPermission } from '$lib/server/permissions';
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

	const canImpersonateUsers = hasPermission(locals, 'dev.impersonate');

	let devUsers: { id: string; username: string; role: string }[] = [];
	if (canImpersonateUsers) {
		const actor = await getDevImpersonationActorUser(locals.user);
		const candidates = await db
			.select({
				id: table.user.id,
				username: table.user.username,
				role: table.user.role
			})
			.from(table.user);
		devUsers = actor ? await filterUsersForDevImpersonation(actor.role, candidates) : [];
	}

	const passkeys = await db
		.select({
			id: table.passkey.id,
			createdAt: table.passkey.createdAt,
			lastUsedAt: table.passkey.lastUsedAt
		})
		.from(table.passkey)
		.where(eq(table.passkey.userId, locals.user.id));
	const roleEditMode = await getRoleEditMode(locals.user.role);

	return {
		user: locals.user,
		canEditDirectMode: roleEditMode === 'user_direct_mode',
		devUsers,
		passkeys
	};
};

export const actions: Actions = {
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

		const actor = await getDevImpersonationActorUser(locals.user);
		if (!actor) {
			return fail(401, { message: 'Compte dev introuvable' });
		}

		const formData = await request.formData();
		const targetUserId = String(formData.get('targetUserId') ?? '').trim();
		if (!targetUserId) {
			return fail(400, { message: 'Utilisateur cible requis' });
		}

		const [targetUser] = await db
			.select({
				id: table.user.id,
				username: table.user.username,
				role: table.user.role
			})
			.from(table.user)
			.where(eq(table.user.id, targetUserId))
			.limit(1);

		if (!targetUser) {
			return fail(404, { message: 'Utilisateur introuvable' });
		}

		const impersonationCheck = await assertDevImpersonationTargetAllowed(
			actor.role,
			targetUser.role
		);
		if (!impersonationCheck.allowed) {
			return fail(403, { message: impersonationCheck.message });
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

		return returnToOwnAccountAction(locals.session.id, cookies);
	}
};
