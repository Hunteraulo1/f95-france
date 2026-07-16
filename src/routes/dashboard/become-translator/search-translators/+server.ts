import { assertDashboardAuthenticated } from '$lib/server/dashboard-auth';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { and, isNull, like } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const escapeIlike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

/** Profils traducteur non liés à un compte, pour la revendication dans le formulaire de candidature. */
export const GET: RequestHandler = async ({ locals, url }) => {
	assertDashboardAuthenticated(locals);

	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);

	const conditions = [isNull(table.translator.userId)];
	if (q) {
		conditions.push(like(table.translator.name, `%${escapeIlike(q)}%`));
	}

	const translators = await db
		.select({ id: table.translator.id, name: table.translator.name })
		.from(table.translator)
		.where(and(...conditions))
		.orderBy(table.translator.name)
		.limit(20);

	return json({ translators });
};
