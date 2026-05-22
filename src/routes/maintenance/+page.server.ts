import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ setHeaders, locals }) => {
	let appName = 'F95 France';
	let maintenanceEnabled = false;

	try {
		const [cfg] = await db
			.select({
				appName: table.config.appName,
				maintenanceMode: table.config.maintenanceMode
			})
			.from(table.config)
			.where(eq(table.config.id, 'main'))
			.limit(1);
		if (cfg?.appName?.trim()) {
			appName = cfg.appName.trim();
		}
		maintenanceEnabled = cfg?.maintenanceMode === true;
	} catch {
		// Valeur par défaut si la config n’est pas joignable
	}

	if (!maintenanceEnabled) {
		throw redirect(302, locals.user ? '/dashboard' : '/');
	}

	setHeaders({
		'Retry-After': '600',
		'Cache-Control': 'no-store'
	});

	return { appName };
};
