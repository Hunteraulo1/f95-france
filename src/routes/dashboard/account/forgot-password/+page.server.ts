import {
	checkPasswordResetRequestThrottle,
	recordPasswordResetRequest
} from '$lib/server/login-throttle';
import { isSmtpConfigured } from '$lib/server/mail';
import { requestPasswordResetByEmail } from '$lib/server/password-reset';
import {
	extractTurnstileTokenFromFormData,
	getTurnstileSiteKey,
	isTurnstileConfigured,
	verifyTurnstileFromForm
} from '$lib/server/turnstile';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		throw redirect(302, '/dashboard');
	}

	return {
		turnstileSiteKey: getTurnstileSiteKey(),
		turnstileEnabled: isTurnstileConfigured(),
		smtpConfigured: isSmtpConfigured()
	};
};

export const actions: Actions = {
	default: async (event) => {
		if (event.locals.user) {
			throw redirect(302, '/dashboard');
		}

		const throttle = await checkPasswordResetRequestThrottle(event);
		if (!throttle.ok) {
			return fail(429, { message: throttle.message });
		}

		const formData = await event.request.formData();

		if (isTurnstileConfigured()) {
			const captcha = await verifyTurnstileFromForm(
				event,
				extractTurnstileTokenFromFormData(formData)
			);
			if (!captcha.ok) {
				return fail(400, { message: captcha.message });
			}
		}

		const email = String(formData.get('email') ?? '').trim();

		const result = await requestPasswordResetByEmail(email, {
			requestOrigin: event.url.origin
		});

		await recordPasswordResetRequest(event);

		if (!result.ok) {
			switch (result.reason) {
				case 'invalid_email':
					return fail(400, { message: 'Veuillez entrer une adresse email valide.' });
				case 'cooldown':
					return fail(429, {
						message:
							'Un email a déjà été envoyé récemment. Patientez quelques minutes avant de réessayer.'
					});
				case 'smtp_not_configured':
					return fail(503, {
						message:
							'L’envoi d’emails n’est pas configuré sur ce serveur. Contactez un administrateur.'
					});
			}
		}

		return { success: true, message: result.message };
	}
};
