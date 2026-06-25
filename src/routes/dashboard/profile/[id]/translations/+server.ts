import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { assertDashboardAuthenticated } from '$lib/server/dashboard-auth';
import { loadProfileTranslationsForUser } from '$lib/server/profile-translations';
import { json, error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params, url }) => {
	assertDashboardAuthenticated(locals);

	const profileRef = String(params.id ?? '').trim();
	if (!profileRef) throw error(400, 'Profil invalide');

	const userByUsername = await db
		.select({ id: table.user.id })
		.from(table.user)
		.where(eq(table.user.username, profileRef))
		.limit(1);

	const user =
		userByUsername[0] ??
		(
			await db
				.select({ id: table.user.id })
				.from(table.user)
				.where(eq(table.user.id, profileRef))
				.limit(1)
		)[0];

	if (!user) throw error(404, 'Utilisateur non trouvé');

	const pageRaw = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
	const requestedPage = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

	const bundle = await loadProfileTranslationsForUser(user.id, { page: requestedPage });

	return json({
		translations: bundle.translations,
		page: bundle.page,
		totalPages: bundle.totalPages,
		total: bundle.totalCount
	});
};
