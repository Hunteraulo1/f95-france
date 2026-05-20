import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ setHeaders }) => {
	setHeaders({
		'Retry-After': '600',
		'Cache-Control': 'no-store'
	});

	let appName = 'F95 France';

	try {
		const [cfg] = await db
			.select({ appName: table.config.appName })
			.from(table.config)
			.where(eq(table.config.id, 'main'))
			.limit(1);
		if (cfg?.appName?.trim()) {
			appName = cfg.appName.trim();
		}
	} catch {
		// Valeur par défaut si la config n’est pas joignable
	}

	return { appName };
};
