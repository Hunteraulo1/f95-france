import {
    finalizeDiscordSignup,
    REGISTRATION_INVITE_INVALID_MESSAGE,
    validateDiscordSignupUsername
} from '$lib/server/discord-auth';
import { getDiscordOAuthConfig } from '$lib/server/discord-oauth';
import {
    clearDiscordSignupPendingCookie,
    readDiscordSignupPendingCookie
} from '$lib/server/discord-signup-pending';
import {
    isRegistrationEnabled,
    isRegistrationInviteRequired,
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

export const load: PageServerLoad = async ({ locals, cookies, url }) => {
	if (locals.user) {
		throw redirect(302, '/dashboard');
	}

	if (!isRegistrationEnabled()) {
		throw redirect(303, '/dashboard/login?registration=disabled');
	}

	const pending = readDiscordSignupPendingCookie(cookies);
	if (!pending) {
		throw redirect(303, '/dashboard/login?discord_error=signup_expired');
	}

	return {
		discordLabel: pending.discordLabel,
		suggestedUsername: pending.suggestedUsername,
		emailMasked: maskEmail(pending.email),
		requiresInviteCode: isRegistrationInviteRequired(),
		hasStoredInvite: Boolean(pending.inviteCode && verifyRegistrationInvite(pending.inviteCode)),
		turnstileSiteKey: getTurnstileSiteKey(),
		turnstileEnabled: isTurnstileConfigured(),
		errorCode: url.searchParams.get('error')
	};
};

function maskEmail(email: string): string {
	const [local, domain] = email.split('@');
	if (!local || !domain) return email;
	const visible = local.length <= 2 ? local[0] ?? '*' : `${local.slice(0, 2)}***`;
	return `${visible}@${domain}`;
}

export const actions: Actions = {
	createAccount: async (event: RequestEvent) => {
		if (!isRegistrationEnabled()) {
			return fail(403, { message: 'Les inscriptions sont actuellement fermées.' });
		}

		const pending = readDiscordSignupPendingCookie(event.cookies);
		if (!pending) {
			return fail(400, {
				message: 'Session Discord expirée. Recommencez la connexion avec Discord.',
				redirectToLogin: true
			});
		}

		const formData = await event.request.formData();
		const username = String(formData.get('username') ?? '').trim();
		const inviteCodeRaw = formData.get('inviteCode');
		const inviteCode =
			typeof inviteCodeRaw === 'string' && inviteCodeRaw.trim().length > 0
				? inviteCodeRaw.trim()
				: pending.inviteCode;

		const captcha = await verifyTurnstileFromForm(
			event,
			extractTurnstileTokenFromFormData(formData)
		);
		if (!captcha.ok) {
			return fail(400, { message: captcha.message });
		}

		const usernameValidation = validateDiscordSignupUsername(username);
		if (usernameValidation) {
			return fail(400, { message: usernameValidation, username });
		}

		if (!verifyRegistrationInvite(inviteCode)) {
			return fail(400, {
				message: REGISTRATION_INVITE_INVALID_MESSAGE,
				username
			});
		}

		const { autoRoleSync, guildId, translatorRoleId } = getDiscordOAuthConfig();

		try {
			const destination = await finalizeDiscordSignup({
				event,
				pending,
				username,
				inviteCode,
				autoRoleSync,
				guildId,
				translatorRoleId
			});
			throw redirect(302, destination);
		} catch (error) {
			if (error && typeof error === 'object' && 'status' in error && error.status === 302) {
				throw error;
			}

			if (error instanceof Error) {
				if (error.message === 'username_taken') {
					return fail(400, {
						message: "Ce nom d'utilisateur est déjà pris.",
						username
					});
				}
				if (error.message === 'account_exists') {
					clearDiscordSignupPendingCookie(event);
					return fail(400, {
						message:
							'Un compte existe déjà avec cet email ou ce Discord. Connectez-vous puis liez Discord dans les paramètres.',
						redirectToLogin: true
					});
				}
				if (error.message.startsWith('username_invalid:')) {
					return fail(400, {
						message: error.message.slice('username_invalid:'.length),
						username
					});
				}
			}

			console.error('[dashboard/register/discord]', error);
			return fail(500, {
				message: 'Impossible de créer le compte pour le moment. Réessayez.',
				username
			});
		}
	}
};
