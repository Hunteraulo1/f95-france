import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { profilePublicPath } from '$lib/server/public-profile-load';
import { error, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

async function resolveProfileUsername(profileRef: string): Promise<string | null> {
	const byUsername = await db
		.select({ username: table.user.username })
		.from(table.user)
		.where(eq(table.user.username, profileRef))
		.limit(1);
	if (byUsername[0]) return byUsername[0].username;

	const byId = await db
		.select({ username: table.user.username })
		.from(table.user)
		.where(eq(table.user.id, profileRef))
		.limit(1);
	return byId[0]?.username ?? null;
}

/** Ancienne URL dashboard → profil public canonique. */
export const load: PageServerLoad = async ({ params, url }) => {
	const profileRef = String(params.id ?? '').trim();
	const username = await resolveProfileUsername(profileRef);
	if (!username) {
		throw error(404, 'Utilisateur non trouvé');
	}
	throw redirect(301, profilePublicPath(username, url.search));
};
