import * as auth from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';
import { fail, redirect } from '@sveltejs/kit';
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
		const username = formData.get('username') as string;
		const password = formData.get('password') as string;

		if (!username || !password) {
			return fail(400, { message: 'Nom d\'utilisateur et mot de passe requis' });
		}

		try {
			const user = await auth.getUserByUsername(username);
			if (!user) {
				return fail(400, { message: 'Nom d\'utilisateur ou mot de passe incorrect' });
			}

			const validPassword = auth.verifyPassword(password, user.passwordHash);
			if (!validPassword) {
				return fail(400, { message: 'Nom d\'utilisateur ou mot de passe incorrect' });
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
			return fail(500, { message: 'Erreur lors de la connexion' });
		}
	}
};
