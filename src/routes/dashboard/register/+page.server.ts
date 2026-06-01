import * as auth from '$lib/server/auth';
import {
	checkLoginThrottle,
	clearLoginThrottle,
	recordLoginFailure
} from '$lib/server/login-throttle';
import {
	isRegistrationEnabled,
	isRegistrationInviteRequired,
	REGISTRATION_ACCOUNT_EXISTS_MESSAGE,
	REGISTRATION_INVITE_INVALID_MESSAGE,
	verifyRegistrationInvite
} from '$lib/server/registration-policy';
import {
	extractTurnstileTokenFromFormData,
	getTurnstileSiteKey,
	isTurnstileConfigured,
	verifyTurnstileFromForm
} from '$lib/server/turnstile';
import type { RequestEvent } from '@sveltejs/kit';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function isDbTimeoutError(error: unknown): boolean {
	if (!error || typeof error !== 'object') return false;
	const maybe = error as { code?: unknown; message?: unknown; cause?: unknown };
	if (maybe.code === 'ETIMEDOUT') return true;
	if (typeof maybe.message === 'string' && maybe.message.includes('ETIMEDOUT')) return true;
	if (maybe.cause && typeof maybe.cause === 'object') {
		const cause = maybe.cause as { code?: unknown; message?: unknown };
		if (cause.code === 'ETIMEDOUT') return true;
		if (typeof cause.message === 'string' && cause.message.includes('ETIMEDOUT')) return true;
	}
	return false;
}

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		throw redirect(302, '/dashboard');
	}

	if (!isRegistrationEnabled()) {
		throw redirect(303, '/dashboard/login?registration=disabled');
	}

	return {
		requiresInviteCode: isRegistrationInviteRequired(),
		turnstileSiteKey: getTurnstileSiteKey(),
		turnstileEnabled: isTurnstileConfigured()
	};
};

export const actions: Actions = {
	register: async (event: RequestEvent) => {
		if (!isRegistrationEnabled()) {
			return fail(403, {
				message: 'Les inscriptions sont actuellement fermées.'
			});
		}

		const throttle = await checkLoginThrottle(event);
		if (!throttle.ok) {
			return fail(429, { message: throttle.message });
		}

		try {
			const formData = await event.request.formData();

			const captcha = await verifyTurnstileFromForm(
				event,
				extractTurnstileTokenFromFormData(formData)
			);
			if (!captcha.ok) {
				return fail(400, { message: captcha.message });
			}
			const username = formData.get('username') as string;
			const email = formData.get('email') as string;
			const password = formData.get('password') as string;
			const confirmPassword = formData.get('confirmPassword') as string;
			const inviteCode = formData.get('inviteCode');

			if (!verifyRegistrationInvite(typeof inviteCode === 'string' ? inviteCode : null)) {
				await recordLoginFailure(event);
				return fail(400, { message: REGISTRATION_INVITE_INVALID_MESSAGE });
			}

			const errors: Record<string, string> = {};

			if (!username || username.length < 3) {
				errors.username = "Le nom d'utilisateur doit contenir au moins 3 caractères";
			}

			if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
				errors.email = 'Veuillez entrer une adresse email valide';
			}

			if (!password || password.length < 8) {
				errors.password = 'Le mot de passe doit contenir au moins 8 caractères';
			}

			if (password !== confirmPassword) {
				errors.confirmPassword = 'Les mots de passe ne correspondent pas';
			}

			let accountExists = false;
			if (username) {
				const existingUserByUsername = await auth.getUserByUsername(username);
				if (existingUserByUsername) {
					accountExists = true;
				}
			}

			if (email) {
				const existingUserByEmail = await auth.getUserByEmail(email);
				if (existingUserByEmail) {
					accountExists = true;
				}
			}

			if (accountExists) {
				await recordLoginFailure(event);
				return fail(400, {
					message: REGISTRATION_ACCOUNT_EXISTS_MESSAGE
				});
			}

			if (Object.keys(errors).length > 0) {
				await recordLoginFailure(event);
				return fail(400, {
					errors,
					message: 'Veuillez corriger les erreurs ci-dessous'
				});
			}

			const user = await auth.createUser(username, email, password);

			try {
				const { notifyNewUserRegistration } = await import('$lib/server/notifications');
				await notifyNewUserRegistration(user.id, username);
			} catch (notificationError) {
				console.error('Erreur lors de la création de la notification:', notificationError);
			}

			const sessionToken = auth.generateSessionToken();
			const session = await auth.createSession(sessionToken, user.id);

			auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);
			await clearLoginThrottle(event);

			throw redirect(302, '/dashboard');
		} catch (error) {
			if (error && typeof error === 'object' && 'status' in error && error.status === 302) {
				throw error;
			}
			if (isDbTimeoutError(error)) {
				return fail(503, {
					message:
						'La base de données ne répond pas pour le moment. Réessayez dans quelques instants.'
				});
			}

			console.error('Erreur lors de la création du compte:', error);
			return fail(500, {
				message: 'Une erreur est survenue lors de la création du compte. Veuillez réessayer.'
			});
		}
	}
};
