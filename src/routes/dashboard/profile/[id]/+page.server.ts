import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const { id } = params;

	const user = await db
		.select({
			id: table.user.id,
			username: table.user.username,
			avatar: table.user.avatar,
			role: table.user.role,
			directMode: table.user.directMode,
			gameAdd: table.user.gameAdd,
			gameEdit: table.user.gameEdit,
			createdAt: table.user.createdAt,
			updatedAt: table.user.updatedAt
		})
		.from(table.user)
		.where(eq(table.user.id, id))
		.limit(1);

	if (user.length === 0) {
		throw error(404, 'Utilisateur non trouvé');
	}

	return {
		user: user[0] || null
	};
};
