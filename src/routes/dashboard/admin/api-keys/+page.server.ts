import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Ancienne URL : redirection permanente vers la gestion API. */
export const load: PageServerLoad = () => {
	throw redirect(308, '/api-management');
};
