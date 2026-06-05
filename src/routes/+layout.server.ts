import { AGE_VERIFICATION_COOKIE } from '$lib/age-verification';
import { isRegistrationEnabled } from '$lib/server/registration-policy';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ url, locals, cookies }) => {
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
		registrationEnabled,
		ageVerified: cookies.get(AGE_VERIFICATION_COOKIE) === '1'
	};
};
