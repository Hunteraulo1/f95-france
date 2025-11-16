import { db } from '$lib/server/db';
import type { Config } from '$lib/server/db/schema';
import * as table from '$lib/server/db/schema';
import { fail } from '@sveltejs/kit';
import { eq, sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Vérifier que l'utilisateur est admin
	if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'superadmin')) {
		throw new Error('Accès non autorisé');
	}

	// Charger la configuration
	let config;
	try {
		config = await db
			.select()
			.from(table.config)
			.where(eq(table.config.id, 'main'))
			.limit(1);

		// Si la configuration n'existe pas, la créer avec les valeurs par défaut
		if (config.length === 0) {
			await db.insert(table.config).values({
				id: 'main',
				appName: 'F95 France'
			});
			config = await db
				.select()
				.from(table.config)
				.where(eq(table.config.id, 'main'))
				.limit(1);
		}
	} catch (error: unknown) {
		// Si la table n'existe pas encore, retourner une configuration par défaut
		console.warn('Table config n\'existe pas encore, utilisation de la configuration par défaut:', error);
		config = [{
			id: 'main',
			appName: 'F95 France',
			discordWebhookUpdates: null,
			discordWebhookLogs: null,
			discordWebhookTranslators: null,
			discordWebhookProofreaders: null,
			googleSpreadsheetId: null,
			updatedAt: new Date()
		} as Config];
	}

	// Charger les utilisateurs avec pagination
	const page = 1;
	const pageSize = 20;
	const users = await db
		.select({
			id: table.user.id,
			username: table.user.username,
			email: table.user.email,
			role: table.user.role,
			avatar: table.user.avatar,
			createdAt: table.user.createdAt
		})
		.from(table.user)
		.orderBy(table.user.createdAt)
		.limit(pageSize)
		.offset((page - 1) * pageSize);

	const totalUsersResult = await db
		.select({ count: sql<number>`count(*)`.as('count') })
		.from(table.user);
	
	const totalUsers = totalUsersResult[0]?.count || 0;

	return {
		config: config[0],
		users,
		totalUsers,
		currentPage: page,
		pageSize
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

		if (!appName) {
			return fail(400, { message: 'Le nom de l\'application est requis' });
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
						googleSpreadsheetId: googleSpreadsheetId || null
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
					googleSpreadsheetId: googleSpreadsheetId || null
				});
			}

			return { success: true, message: 'Configuration mise à jour avec succès' };
		} catch (error: unknown) {
			console.error('Erreur lors de la mise à jour de la configuration:', error);
			
			const mysqlError = error && typeof error === 'object' && 'cause' in error 
				? error.cause as { code?: string; errno?: number; sqlMessage?: string }
				: null;
			
			// Si la table n'existe pas encore
			if (mysqlError && (mysqlError.code === 'ER_NO_SUCH_TABLE' || mysqlError.sqlMessage?.includes('doesn\'t exist'))) {
				return fail(500, { message: 'La table de configuration n\'existe pas encore. Veuillez exécuter "npm run db:push" pour créer la table.' });
			}
			
			return fail(500, { message: 'Erreur lors de la mise à jour de la configuration' });
		}
	},

	updateUser: async ({ request, locals }) => {
		// Vérifier que l'utilisateur est admin
		if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'superadmin')) {
			return fail(403, { message: 'Accès non autorisé' });
		}

		const formData = await request.formData();
		const userId = formData.get('userId') as string;
		const username = formData.get('username') as string;
		const email = formData.get('email') as string;
		const role = formData.get('role') as string;
		const avatar = formData.get('avatar') as string;

		if (!userId || !username || !email || !role) {
			return fail(400, { message: 'Tous les champs sont requis' });
		}

		// Vérifier que le rôle est valide
		if (!['user', 'translator', 'admin', 'superadmin'].includes(role)) {
			return fail(400, { message: 'Rôle invalide' });
		}

		try {
			// Récupérer l'utilisateur actuel pour préserver l'avatar si non fourni
			const currentUser = await db
				.select({ avatar: table.user.avatar })
				.from(table.user)
				.where(eq(table.user.id, userId))
				.limit(1);

			await db
				.update(table.user)
				.set({
					username,
					email,
					role,
					avatar: avatar || currentUser[0]?.avatar || ''
				})
				.where(eq(table.user.id, userId));

			return { success: true, message: 'Utilisateur mis à jour avec succès' };
		} catch (error: unknown) {
			console.error('Erreur lors de la mise à jour de l\'utilisateur:', error);
			
			const mysqlError = error && typeof error === 'object' && 'cause' in error 
				? error.cause as { code?: string; errno?: number; sqlMessage?: string }
				: null;
			
			if (mysqlError && (mysqlError.code === 'ER_DUP_ENTRY' || mysqlError.errno === 1062)) {
				if (mysqlError.sqlMessage?.includes('username')) {
					return fail(409, { message: `Un utilisateur avec le nom "${username}" existe déjà` });
				}
				if (mysqlError.sqlMessage?.includes('email')) {
					return fail(409, { message: `Un utilisateur avec l'email "${email}" existe déjà` });
				}
				return fail(409, { message: 'Cet utilisateur existe déjà' });
			}
			
			return fail(500, { message: 'Erreur lors de la mise à jour de l\'utilisateur' });
		}
	}
};
