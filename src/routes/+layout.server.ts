import { isRegistrationEnabled } from '$lib/server/registration-policy';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ url, locals }) => {
	const pathname = url.pathname;
	const registrationEnabled = isRegistrationEnabled();

	if (pathname.startsWith('/dashboard')) {
		if (pathname === '/dashboard/register' && !registrationEnabled) {
			redirect(303, '/dashboard/login?registration=disabled');
		}

		const isAuthPage = pathname === '/dashboard/login' || pathname === '/dashboard/register';
		if (isAuthPage && locals.user) {
			redirect(302, '/dashboard');
		}
	}

	return {
		user: locals.user,
		registrationEnabled
	};
};
