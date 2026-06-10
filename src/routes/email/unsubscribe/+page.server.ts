import { unsubscribeFromMarketingEmails } from '$lib/server/email-verification';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const token = url.searchParams.get('token')?.trim() ?? '';

	if (!token) {
		return { status: 'missing' as const };
	}

	const result = await unsubscribeFromMarketingEmails(token);
	if (!result.ok) {
		return { status: 'invalid' as const };
	}

	return { status: 'ok' as const, username: result.username };
};
