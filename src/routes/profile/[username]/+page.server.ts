import { loadPublicProfile, profilePublicPath } from '$lib/server/public-profile-load';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, locals }) => {
	const profileRef = String(params.username ?? '').trim();
	const data = await loadPublicProfile({
		profileRef,
		url,
		viewerUserId: locals.user?.id ?? null
	});

	if (data.lookedUpByUserId && profileRef !== data.profileSlug) {
		throw redirect(301, profilePublicPath(data.profileSlug, url.search));
	}

	return data;
};
