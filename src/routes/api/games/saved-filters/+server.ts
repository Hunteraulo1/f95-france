import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import {
	parseSavedGamesFilters,
	serializeSavedGamesFilters
} from '$lib/server/saved-filters';
import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Non authentifié' }, { status: 401 });
	}

	const [row] = await db
		.select({ savedGamesFilters: user.savedGamesFilters })
		.from(user)
		.where(eq(user.id, locals.user.id))
		.limit(1);

	return json({ filters: parseSavedGamesFilters(row?.savedGamesFilters) });
};

export const PUT: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		return json({ error: 'Non authentifié' }, { status: 401 });
	}

	const body = await request.json().catch(() => null);
	const payload = serializeSavedGamesFilters(body && typeof body === 'object' ? body.filters : []);

	await db
		.update(user)
		.set({ savedGamesFilters: payload, updatedAt: new Date() })
		.where(eq(user.id, locals.user.id));

	return json({ ok: true });
};
