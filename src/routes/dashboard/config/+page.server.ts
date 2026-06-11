import { toConfigClientSafe } from '$lib/server/app-config';
import { db } from '$lib/server/db';
import type { Config } from '$lib/server/db/schema';
import * as table from '$lib/server/db/schema';
import { invalidateMaintenanceModeCache } from '$lib/server/maintenance-mode';
import { assertPermission, hasPermission } from '$lib/server/permissions';
import { error, fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

const DEFAULT_CONFIG_ROW = {
	id: 'main',
	appName: 'F95 France',
	googleSpreadsheetId: null,
	googleOAuthAccessToken: null,
	googleOAuthRefreshToken: null,
	googleOAuthTokenExpiry: null,
	autoCheckLastRunAt: null,
	maintenanceMode: false,
	updatedAt: new Date()
} satisfies Config;

function permissionFlags(locals: App.Locals) {
	return {
		canEditConfig: hasPermission(locals, 'config.edit'),
		canManageMaintenance: hasPermission(locals, 'maintenance.manage')
	};
}

export const load: PageServerLoad = async ({ locals }) => {
	await assertPermission(locals, 'config.view');

	const { canEditConfig, canManageMaintenance } = permissionFlags(locals);

	let config;
	try {
		config = await db.select().from(table.config).where(eq(table.config.id, 'main')).limit(1);

		// Création initiale réservée aux comptes autorisés à modifier la config.
		if (config.length === 0 && canEditConfig) {
			await db.insert(table.config).values({
				id: 'main',
				appName: 'F95 France'
			});
			config = await db.select().from(table.config).where(eq(table.config.id, 'main')).limit(1);
		}
	} catch (err: unknown) {
		console.warn(
			"Table config n'existe pas encore, utilisation de la configuration par défaut:",
			err
		);
		config = [DEFAULT_CONFIG_ROW];
	}

	const row = config[0] ?? DEFAULT_CONFIG_ROW;
	const clientConfig = toConfigClientSafe(row);

	return {
		config: {
			...clientConfig,
			// Valeur éditable en base (pas l’ID effectif issu de l’env pour l’affichage formulaire).
			googleSpreadsheetId: row.googleSpreadsheetId?.trim() ?? ''
		},
		canEditConfig,
		canManageMaintenance,
		canSave: canEditConfig || canManageMaintenance
	};
};

export const actions: Actions = {
	updateConfig: async ({ request, locals }) => {
		const { canEditConfig, canManageMaintenance } = permissionFlags(locals);

		if (!canEditConfig && !canManageMaintenance) {
			error(403, 'Accès non autorisé');
		}

		const formData = await request.formData();
		const appNameRaw = formData.get('appName');
		const spreadsheetRaw = formData.get('googleSpreadsheetId');
		const appName = typeof appNameRaw === 'string' ? appNameRaw.trim() : '';
		const googleSpreadsheetId = typeof spreadsheetRaw === 'string' ? spreadsheetRaw.trim() : '';
		const wantsConfigFields = appNameRaw !== null || spreadsheetRaw !== null;

		try {
			const existingConfig = await db
				.select()
				.from(table.config)
				.where(eq(table.config.id, 'main'))
				.limit(1);

			const currentConfig = existingConfig[0];
			const currentMaintenance = currentConfig?.maintenanceMode ?? false;
			const nextMaintenance = canManageMaintenance
				? formData.get('maintenanceMode') === 'on'
				: currentMaintenance;
			const maintenanceChanged = canManageMaintenance && nextMaintenance !== currentMaintenance;

			if (wantsConfigFields && !canEditConfig) {
				return fail(403, {
					message: 'Droit « Configuration (écriture) » requis pour modifier ces champs'
				});
			}

			if (!canEditConfig && !maintenanceChanged) {
				return fail(403, { message: 'Aucune modification autorisée avec vos droits actuels' });
			}

			if (canEditConfig && !appName) {
				return fail(400, { message: "Le nom de l'application est requis" });
			}

			const keepCurrentIfEmpty = (value: string, currentValue: string | null) => {
				const trimmed = value?.trim() ?? '';
				return trimmed === '' ? currentValue : trimmed;
			};

			const patch: {
				appName?: string;
				googleSpreadsheetId?: string | null;
				maintenanceMode: boolean;
			} = {
				maintenanceMode: nextMaintenance
			};

			if (canEditConfig) {
				patch.appName = appName;
				patch.googleSpreadsheetId = keepCurrentIfEmpty(
					googleSpreadsheetId,
					currentConfig?.googleSpreadsheetId ?? null
				);
			}

			if (existingConfig.length > 0) {
				await db.update(table.config).set(patch).where(eq(table.config.id, 'main'));
			} else if (canEditConfig) {
				await db.insert(table.config).values({
					id: 'main',
					appName,
					googleSpreadsheetId: googleSpreadsheetId || null,
					maintenanceMode: patch.maintenanceMode
				});
			} else {
				return fail(403, {
					message:
						'Configuration absente : droit « Configuration (écriture) » requis pour l’initialiser'
				});
			}

			if (maintenanceChanged) {
				invalidateMaintenanceModeCache();
			}

			return { success: true, message: 'Configuration mise à jour avec succès' };
		} catch (err: unknown) {
			console.error('Erreur lors de la mise à jour de la configuration:', err);

			const mysqlError =
				err && typeof err === 'object' && 'cause' in err
					? (err.cause as { code?: string; errno?: number; sqlMessage?: string })
					: null;

			if (
				mysqlError &&
				(mysqlError.code === 'ER_NO_SUCH_TABLE' || mysqlError.sqlMessage?.includes("doesn't exist"))
			) {
				return fail(500, {
					message:
						'La table de configuration n\'existe pas encore. Veuillez exécuter "npm run db:push" pour créer la table.'
				});
			}

			return fail(500, { message: 'Erreur lors de la mise à jour de la configuration' });
		}
	}
};
