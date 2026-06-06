import * as auth from '$lib/server/auth';
import { safeDashboardRedirectPath } from '$lib/server/dashboard-auth';
import {
    dashboardVerifyEmailPath,
    emailVerificationRequired,
    isUserEmailVerified
} from '$lib/server/email-verification';
import {
    checkLoginThrottle,
    clearLoginThrottle,
    loginRequiresCaptcha,
    recordLoginFailure
} from '$lib/server/login-throttle';
import { isRegistrationEnabled } from '$lib/server/registration-policy';
import {
    extractTurnstileTokenFromFormData,
    getTurnstileSiteKey,
    isTurnstileConfigured,
    verifyTurnstileFromForm
} from '$lib/server/turnstile';
import type { RequestEvent } from '@sveltejs/kit';
import { fail, redirect } from '@sveltejs/kit';
import * as OTPAuth from 'otpauth';
import type { Actions, PageServerLoad } from './$types';

export type LoginPageLoadData = {
	redirectTo: string;
	registrationEnabled: boolean;
	registrationNotice: string | null;
	resetNotice: string | null;
	turnstileSiteKey: string;
	turnstileEnabled: boolean;
	requiresCaptcha: boolean;
};

export const load: PageServerLoad<LoginPageLoadData> = async (event) => {
	const { locals, url } = event;

	if (locals.user) {
		throw redirect(302, safeDashboardRedirectPath(url.searchParams.get('redirectTo')));
	}

	const registrationParam = url.searchParams.get('registration');
	let registrationNotice: string | null = null;
	if (registrationParam === 'disabled') {
		registrationNotice = 'Les inscriptions sont actuellement fermées.';
	}

	const resetNotice =
		url.searchParams.get('reset') === '1'
			? 'Votre mot de passe a été mis à jour. Vous pouvez vous connecter.'
			: null;

	const requiresCaptcha = await loginRequiresCaptcha(event);

	return {
		redirectTo: safeDashboardRedirectPath(url.searchParams.get('redirectTo')),
		registrationEnabled: isRegistrationEnabled(),
		registrationNotice,
		resetNotice,
		turnstileSiteKey: getTurnstileSiteKey(),
		turnstileEnabled: isTurnstileConfigured(),
		requiresCaptcha
	};
};

export const actions: Actions = {
	login: async (event: RequestEvent) => {
		const formData = await event.request.formData();
		const username = String(formData.get('username') ?? '').trim();
		const password = String(formData.get('password') ?? '');
		const twoFactorCode = String(formData.get('twoFactorCode') ?? '').trim();

		const needsCaptcha = await loginRequiresCaptcha(event);

		if (!username && !password) {
			return fail(400, {
				message: "Nom d'utilisateur et mot de passe requis.",
				requiresCaptcha: needsCaptcha
			});
		}
		if (!username) {
			return fail(400, {
				message: "Le nom d'utilisateur est requis.",
				requiresCaptcha: needsCaptcha
			});
		}
		if (!password) {
			return fail(400, { message: 'Le mot de passe est requis.', requiresCaptcha: needsCaptcha });
		}

		const throttle = await checkLoginThrottle(event);
		if (!throttle.ok) {
			return fail(429, { message: throttle.message, requiresCaptcha: true });
		}

		if (needsCaptcha) {
			const captcha = await verifyTurnstileFromForm(
				event,
				extractTurnstileTokenFromFormData(formData)
			);
			if (!captcha.ok) {
				return fail(400, { message: captcha.message, requiresCaptcha: true });
			}
		}

		try {
			const user = await auth.getUserByUsername(username);
			if (!user) {
				await recordLoginFailure(event);
				return fail(400, {
					message: auth.INVALID_CREDENTIALS_MESSAGE,
					requiresCaptcha: true
				});
			}

			const passwordCheck = await auth.verifyPassword(password, user.passwordHash);
			if (!passwordCheck.valid) {
				await recordLoginFailure(event);
				return fail(400, {
					message: auth.INVALID_CREDENTIALS_MESSAGE,
					requiresCaptcha: true
				});
			}

			if (user.twoFactorEnabled && user.twoFactorSecret) {
				if (!/^\d{6}$/.test(twoFactorCode)) {
					return fail(400, {
						message: 'La double authentification est active. Saisissez un code 2FA à 6 chiffres.',
						requiresCaptcha: needsCaptcha
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
					await recordLoginFailure(event);
					return fail(400, {
						message: 'Code 2FA invalide ou expiré.',
						requiresCaptcha: true
					});
				}
			}

			if (passwordCheck.needsRehash) {
				await auth.rehashPasswordIfNeeded(user.id, password);
			}

			const sessionToken = auth.generateSessionToken();
			const session = await auth.createSession(sessionToken, user.id);
			auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);
			await clearLoginThrottle(event);

			const formRedirect = formData.get('redirectTo');
			let destination = safeDashboardRedirectPath(
				typeof formRedirect === 'string' ? formRedirect : null
			);

			if (
				emailVerificationRequired() &&
				!isUserEmailVerified(user) &&
				destination !== dashboardVerifyEmailPath()
			) {
				destination = dashboardVerifyEmailPath();
			}

			throw redirect(302, destination);
		} catch (error) {
			if (error && typeof error === 'object' && 'status' in error && error.status === 302) {
				throw error;
			}
			console.error('[dashboard/login?/login]', error);
			return fail(500, {
				message: 'Impossible de finaliser la connexion pour le moment (erreur serveur).',
				requiresCaptcha: needsCaptcha
			});
		}
	}
};
