import { resetPasswordWithToken, validatePasswordResetToken } from '$lib/server/password-reset';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const token = url.searchParams.get('token')?.trim() ?? '';

	if (!token) {
		return { status: 'missing' as const, token: '' };
	}

	const result = await validatePasswordResetToken(token);
	if (!result.ok) {
		return { status: result.reason, token: '' };
	}

	return { status: 'ready' as const, token };
};

export const actions: Actions = {
	reset: async ({ request, url }) => {
		const formData = await request.formData();
		const tokenFromForm = String(formData.get('token') ?? '').trim();
		const tokenFromQuery = url.searchParams.get('token')?.trim() ?? '';
		const token = tokenFromForm || tokenFromQuery;
		const password = String(formData.get('password') ?? '');
		const confirmPassword = String(formData.get('confirmPassword') ?? '');

		if (!token) {
			return fail(400, { success: false, message: 'Lien de réinitialisation invalide.', token: '' });
		}

		if (!password || password.length < 8) {
			return fail(400, {
				success: false,
				message: 'Le mot de passe doit contenir au moins 8 caractères.',
				token
			});
		}

		if (password !== confirmPassword) {
			return fail(400, {
				success: false,
				message: 'Les mots de passe ne correspondent pas.',
				token
			});
		}

		const result = await resetPasswordWithToken(token, password);

		if (!result.ok) {
			switch (result.reason) {
				case 'expired':
					return fail(400, {
						success: false,
						message: 'Ce lien a expiré. Demandez un nouvel email de réinitialisation.',
						token: ''
					});
				case 'weak_password':
					return fail(400, {
						success: false,
						message: 'Le mot de passe doit contenir au moins 8 caractères.',
						token
					});
				default:
					return fail(400, {
						success: false,
						message: 'Ce lien de réinitialisation n’est pas valide ou a déjà été utilisé.',
						token: ''
					});
			}
		}

		return {
			success: true,
			message: 'Mot de passe mis à jour. Vous pouvez vous connecter.',
			token: ''
		};
	}
};
