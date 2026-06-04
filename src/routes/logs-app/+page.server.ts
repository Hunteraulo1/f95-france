import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Alias public `/logs-app` → dashboard (auth + layout). */
export const load: PageServerLoad = async ({ url }) => {
	const target = url.search ? `/dashboard/logs-app${url.search}` : '/dashboard/logs-app';
	redirect(303, target);
};
