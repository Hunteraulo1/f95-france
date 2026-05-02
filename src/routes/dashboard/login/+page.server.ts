import * as auth from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';
import { fail, redirect } from '@sveltejs/kit';
import * as OTPAuth from 'otpauth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		throw redirect(302, '/dashboard');
	}

	return {};
};

export const actions: Actions = {
	login: async (event: RequestEvent) => {
		const formData = await event.request.formData();
		const username = String(formData.get('username') ?? '').trim();
		const password = String(formData.get('password') ?? '');
		const twoFactorCode = String(formData.get('twoFactorCode') ?? '').trim();

		if (!username && !password) {
			return fail(400, { message: "Nom d'utilisateur et mot de passe requis." });
		}
		if (!username) {
			return fail(400, { message: "Le nom d'utilisateur est requis." });
		}
		if (!password) {
			return fail(400, { message: 'Le mot de passe est requis.' });
		}

		try {
			const user = await auth.getUserByUsername(username);
			if (!user) {
				return fail(400, { message: "Aucun compte trouvé pour ce nom d'utilisateur." });
			}

			const validPassword = auth.verifyPassword(password, user.passwordHash);
			if (!validPassword) {
				return fail(400, { message: 'Mot de passe incorrect.' });
			}

			if (user.twoFactorEnabled && user.twoFactorSecret) {
				if (!/^\d{6}$/.test(twoFactorCode)) {
					return fail(400, {
						message: 'La double authentification est active. Saisissez un code 2FA à 6 chiffres.'
					});
				}

				const totp = new OTPAuth.TOTP({
					issuer: 'F95 France',
					label: user.username,
					algorithm: 'SHA1',
					digits: 6,
					period: 30,
					secret: OTPAuth.Secret.fromBase32(user.twoFactorSecret)
				});
				const delta = totp.validate({ token: twoFactorCode, window: 1 });
				if (delta === null) {
					return fail(400, { message: 'Code 2FA invalide ou expiré.' });
				}
			}

			// Créer une session
			const sessionToken = auth.generateSessionToken();
			const session = await auth.createSession(sessionToken, user.id);
			auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);

			throw redirect(302, '/dashboard');
		} catch (error) {
			if (error && typeof error === 'object' && 'status' in error && error.status === 302) {
				throw error;
			}
			return fail(500, {
				message: 'Impossible de finaliser la connexion pour le moment (erreur serveur).'
			});
		}
	}
};
