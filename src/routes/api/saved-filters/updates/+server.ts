import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { parseSavedUpdatesFilters, serializeSavedUpdatesFilters } from '$lib/server/saved-filters';
import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Non authentifié' }, { status: 401 });
	}

	const [row] = await db
		.select({ savedUpdatesFilters: user.savedUpdatesFilters })
		.from(user)
		.where(eq(user.id, locals.user.id))
		.limit(1);

	return json({ filters: parseSavedUpdatesFilters(row?.savedUpdatesFilters) });
};

export const PUT: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		return json({ error: 'Non authentifié' }, { status: 401 });
	}

	const body = await request.json().catch(() => null);
	const payload = serializeSavedUpdatesFilters(
		body && typeof body === 'object' ? body.filters : []
	);

	await db
		.update(user)
		.set({ savedUpdatesFilters: payload, updatedAt: new Date() })
		.where(eq(user.id, locals.user.id));

	return json({ ok: true });
};
