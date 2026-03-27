import { db } from '$lib/server/db';
import type { Config } from '$lib/server/db/schema';
import * as table from '$lib/server/db/schema';
import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Vérifier que l'utilisateur est admin
	if (!locals.user || (locals.user.role !== 'superadmin')) {
		throw new Error('Accès non autorisé');
	}

	// Charger la configuration
	let config;
	try {
		config = await db.select().from(table.config).where(eq(table.config.id, 'main')).limit(1);

		// Si la configuration n'existe pas, la créer avec les valeurs par défaut
		if (config.length === 0) {
			await db.insert(table.config).values({
				id: 'main',
				appName: 'F95 France'
			});
			config = await db.select().from(table.config).where(eq(table.config.id, 'main')).limit(1);
		}
	} catch (error: unknown) {
		// Si la table n'existe pas encore, retourner une configuration par défaut
		console.warn(
			"Table config n'existe pas encore, utilisation de la configuration par défaut:",
			error
		);
		config = [
			{
				id: 'main',
				appName: 'F95 France',
				discordWebhookUpdates: null,
				discordWebhookLogs: null,
				discordWebhookTranslators: null,
				discordWebhookProofreaders: null,
				googleSpreadsheetId: null,
				googleApiKey: null,
				googleOAuthClientId: null,
				googleOAuthClientSecret: null,
				googleOAuthAccessToken: null,
				googleOAuthRefreshToken: null,
				googleOAuthTokenExpiry: null,
				updatedAt: new Date()
			} as Config
		];
	}

	return {
		config: config[0]
	};
};

export const actions: Actions = {
	updateConfig: async ({ request, locals }) => {
		// Vérifier que l'utilisateur est admin
		if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'superadmin')) {
			return fail(403, { message: 'Accès non autorisé' });
		}

		const formData = await request.formData();
		const appName = formData.get('appName') as string;
		const discordWebhookUpdates = formData.get('discordWebhookUpdates') as string;
		const discordWebhookLogs = formData.get('discordWebhookLogs') as string;
		const discordWebhookTranslators = formData.get('discordWebhookTranslators') as string;
		const discordWebhookProofreaders = formData.get('discordWebhookProofreaders') as string;
		const googleSpreadsheetId = formData.get('googleSpreadsheetId') as string;
		const googleApiKey = formData.get('googleApiKey') as string;
		const googleOAuthClientId = formData.get('googleOAuthClientId') as string;
		const googleOAuthClientSecret = formData.get('googleOAuthClientSecret') as string;

		if (!appName) {
			return fail(400, { message: "Le nom de l'application est requis" });
		}

		try {
			// Vérifier si la configuration existe
			const existingConfig = await db
				.select()
				.from(table.config)
				.where(eq(table.config.id, 'main'))
				.limit(1);

			if (existingConfig.length > 0) {
				// Mettre à jour la configuration existante
				await db
					.update(table.config)
					.set({
						appName,
						discordWebhookUpdates: discordWebhookUpdates || null,
						discordWebhookLogs: discordWebhookLogs || null,
						discordWebhookTranslators: discordWebhookTranslators || null,
						discordWebhookProofreaders: discordWebhookProofreaders || null,
						googleSpreadsheetId: googleSpreadsheetId || null,
						googleApiKey: googleApiKey || null,
						googleOAuthClientId: googleOAuthClientId || null,
						googleOAuthClientSecret: googleOAuthClientSecret || null
					})
					.where(eq(table.config.id, 'main'));
			} else {
				// Créer la configuration si elle n'existe pas
				await db.insert(table.config).values({
					id: 'main',
					appName,
					discordWebhookUpdates: discordWebhookUpdates || null,
					discordWebhookLogs: discordWebhookLogs || null,
					discordWebhookTranslators: discordWebhookTranslators || null,
					discordWebhookProofreaders: discordWebhookProofreaders || null,
					googleSpreadsheetId: googleSpreadsheetId || null,
					googleApiKey: googleApiKey || null,
					googleOAuthClientId: googleOAuthClientId || null,
					googleOAuthClientSecret: googleOAuthClientSecret || null
				});
			}

			return { success: true, message: 'Configuration mise à jour avec succès' };
		} catch (error: unknown) {
			console.error('Erreur lors de la mise à jour de la configuration:', error);

			const mysqlError =
				error && typeof error === 'object' && 'cause' in error
					? (error.cause as { code?: string; errno?: number; sqlMessage?: string })
					: null;

			// Si la table n'existe pas encore
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
