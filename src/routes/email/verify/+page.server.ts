import { dashboardVerifyEmailPath, verifyEmailWithToken } from '$lib/server/email-verification';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	const token = url.searchParams.get('token')?.trim() ?? '';

	if (!token) {
		return { status: 'missing' as const };
	}

	const result = await verifyEmailWithToken(token);

	if (result.ok) {
		if (locals.user?.id === result.userId) {
			throw redirect(303, `${dashboardVerifyEmailPath()}?verified=1`);
		}
		return { status: 'verified' as const };
	}

	return { status: result.reason };
};
