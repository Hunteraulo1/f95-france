import { assertDashboardAuthenticated } from '$lib/server/dashboard-auth';
import {
    emailVerificationRequired,
    isUserEmailVerified,
    sendVerificationEmailForUser
} from '$lib/server/email-verification';
import { isSmtpConfigured } from '$lib/server/mail';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	assertDashboardAuthenticated(locals);

	if (!emailVerificationRequired() || isUserEmailVerified(locals.user)) {
		throw redirect(303, '/dashboard');
	}

	const verified = url.searchParams.get('verified') === '1';

	return {
		email: locals.user.email,
		smtpConfigured: isSmtpConfigured(),
		justVerified: verified
	};
};

export const actions: Actions = {
	resend: async ({ locals, url }) => {
		assertDashboardAuthenticated(locals);

		if (!emailVerificationRequired() || isUserEmailVerified(locals.user)) {
			throw redirect(303, '/dashboard');
		}

		const result = await sendVerificationEmailForUser(locals.user.id, {
			requestOrigin: url.origin
		});

		if (result.ok) {
			return { success: true, message: 'Un nouvel email de vérification a été envoyé.' };
		}

		switch (result.reason) {
			case 'cooldown':
				return fail(429, {
					message: 'Veuillez patienter quelques minutes avant de renvoyer un email.'
				});
			case 'smtp_not_configured':
				return fail(503, {
					message: 'L’envoi d’emails n’est pas configuré sur ce serveur. Contactez un administrateur.'
				});
			case 'send_failed':
				return fail(502, {
					message: 'Impossible d’envoyer l’email pour le moment. Réessayez plus tard.'
				});
			default:
				return fail(400, { message: 'Impossible d’envoyer l’email de vérification.' });
		}
	}
};
