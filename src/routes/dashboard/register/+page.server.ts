import * as auth from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Si l'utilisateur est déjà connecté, rediriger vers le dashboard
	if (locals.user) {
		throw redirect(302, '/dashboard');
	}
	
	return {};
};

export const actions: Actions = {
	register: async (event: RequestEvent) => {
		const formData = await event.request.formData();
		const username = formData.get('username') as string;
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;
		const confirmPassword = formData.get('confirmPassword') as string;

		// Validation des données
		const errors: Record<string, string> = {};

		if (!username || username.length < 3) {
			errors.username = 'Le nom d\'utilisateur doit contenir au moins 3 caractères';
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

		// Vérifier si l'utilisateur existe déjà
		if (username) {
			const existingUserByUsername = await auth.getUserByUsername(username);
			if (existingUserByUsername) {
				errors.username = 'Ce nom d\'utilisateur est déjà utilisé';
			}
		}

		if (email) {
			const existingUserByEmail = await auth.getUserByEmail(email);
			if (existingUserByEmail) {
				errors.email = 'Cette adresse email est déjà utilisée';
			}
		}

		// Si il y a des erreurs, les retourner
		if (Object.keys(errors).length > 0) {
			return fail(400, {
				errors,
				message: 'Veuillez corriger les erreurs ci-dessous'
			});
		}

		try {
			// Créer l'utilisateur
			const user = await auth.createUser(username, email, password);

			// Créer une session
			const sessionToken = auth.generateSessionToken();
			const session = await auth.createSession(sessionToken, user.id);

			// Définir le cookie de session
			auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);

			// Rediriger vers le dashboard
			throw redirect(302, '/dashboard');
		} catch (error) {
			// Si c'est une redirection, la laisser passer
			if (error && typeof error === 'object' && 'status' in error && error.status === 302) {
				throw error;
			}
			
			console.error('Erreur lors de la création du compte:', error);
			return fail(500, {
				message: 'Une erreur est survenue lors de la création du compte. Veuillez réessayer.'
			});
		}
	}
};
