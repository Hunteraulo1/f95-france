import { db } from '$lib/server/db';
import { translator } from '$lib/server/db/schema';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		const translators = await db.select().from(translator);
		return json(translators);
	} catch (error) {
		console.error('Error fetching translators:', error);
		return json({ error: 'Failed to fetch translators' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { name } = body;

	if (!name || typeof name !== 'string') {
		return json({ error: 'Name is required' }, { status: 400 });
	}

	const trimmedName = name.trim();

	try {
		await db.insert(translator).values({
			name: trimmedName,
			pages: '',
			tradCount: 0,
			readCount: 0
		});

		return json({ success: true, name: trimmedName }, { status: 201 });
	} catch (error: unknown) {
		console.error('Error creating translator:', error);

		// Vérifier si c'est une erreur de duplication
		const mysqlError =
			error && typeof error === 'object' && 'cause' in error
				? (error.cause as { code?: string; errno?: number; sqlMessage?: string })
				: null;

		if (mysqlError && (mysqlError.code === 'ER_DUP_ENTRY' || mysqlError.errno === 1062)) {
			if (mysqlError.sqlMessage?.includes('translator_name_unique')) {
				return json(
					{ error: `Un traducteur avec le nom "${trimmedName}" existe déjà` },
					{ status: 409 }
				);
			}
			if (mysqlError.sqlMessage?.includes('discord_id')) {
				return json({ error: 'Un traducteur avec cet ID Discord existe déjà' }, { status: 409 });
			}
			return json({ error: 'Ce traducteur existe déjà' }, { status: 409 });
		}

		return json({ error: 'Failed to create translator' }, { status: 500 });
	}
};
