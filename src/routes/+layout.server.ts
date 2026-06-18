import { AGE_VERIFICATION_COOKIE } from '$lib/age-verification';
import { privateEnv } from '$lib/server/private-env';
import { isRegistrationEnabled } from '$lib/server/registration-policy';
import { siteOrigin } from '$lib/site';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ url, locals, cookies }) => {
	const pathname = url.pathname;
	const registrationEnabled = isRegistrationEnabled();

	if (pathname.startsWith('/dashboard')) {
		if (pathname === '/dashboard/account/register' && !registrationEnabled) {
			redirect(303, '/dashboard/account/login?registration=disabled');
		}

		const isAuthPage =
			pathname === '/dashboard/account/login' ||
			pathname === '/dashboard/account/register' ||
			pathname === '/dashboard/account/forgot-password';
		if (isAuthPage && locals.user) {
			redirect(302, '/dashboard');
		}
	}

	const bypassVerif = url.searchParams.has('bypassVerif');

	return {
		user: locals.user,
		registrationEnabled,
		ageVerified: bypassVerif || cookies.get(AGE_VERIFICATION_COOKIE) === '1',
		origin: siteOrigin(privateEnv('SERVICE_URL_APP'))
	};
};
