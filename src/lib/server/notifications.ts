import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { eq, sql, and, desc } from 'drizzle-orm';

export type NotificationType =
	| 'submission_status_changed'
	| 'new_user_registered'
	| 'submission_accepted'
	| 'submission_rejected'
	| 'api_error';

interface CreateNotificationParams {
	userId: string;
	type: NotificationType;
	title: string;
	message: string;
	link?: string;
	metadata?: Record<string, unknown>;
}

/**
 * Crée une nouvelle notification
 */
export async function createNotification(params: CreateNotificationParams) {
	const { userId, type, title, message, link, metadata } = params;

	try {
		await db.insert(table.notification).values({
			userId,
			type,
			title,
			message,
			link: link || null,
			metadata: metadata ? JSON.stringify(metadata) : null,
			read: false
		});
	} catch (error: unknown) {
		// Si la table n'existe pas encore, logger l'erreur mais ne pas la propager
		if (
			error &&
			typeof error === 'object' &&
			'cause' in error &&
			error.cause &&
			typeof error.cause === 'object' &&
			'code' in error.cause &&
			error.cause.code === 'ER_NO_SUCH_TABLE'
		) {
			console.warn('Table notification n\'existe pas encore. Créez la migration avec: npm run db:generate');
			return;
		}
		// Propager les autres erreurs
		throw error;
	}
}

/**
 * Crée une notification pour un changement de statut de soumission
 */
export async function notifySubmissionStatusChange(
	submissionUserId: string,
	submissionId: string,
	oldStatus: string,
	newStatus: string,
	submissionType: string
) {
	const statusLabels: Record<string, string> = {
		pending: 'en attente',
		accepted: 'acceptée',
		rejected: 'refusée'
	};

	const typeLabels: Record<string, string> = {
		game: 'jeu',
		translation: 'traduction',
		update: 'mise à jour',
		delete: 'suppression'
	};

	const title =
		newStatus === 'accepted'
			? 'Soumission acceptée'
			: newStatus === 'rejected'
				? 'Soumission refusée'
				: 'Statut de soumission modifié';

	const message = `Votre soumission de ${typeLabels[submissionType] || submissionType} est maintenant ${statusLabels[newStatus] || newStatus}.`;

	await createNotification({
		userId: submissionUserId,
		type: newStatus === 'accepted' ? 'submission_accepted' : 'submission_rejected',
		title,
		message,
		link: `/dashboard/submit`,
		metadata: {
			submissionId,
			oldStatus,
			newStatus,
			submissionType
		}
	});
}

/**
 * Crée une notification pour un nouvel utilisateur inscrit (pour les superadmins)
 */
export async function notifyNewUserRegistration(userId: string, username: string) {
	// Récupérer tous les superadmins
	const superadmins = await db
		.select({ id: table.user.id })
		.from(table.user)
		.where(eq(table.user.role, 'superadmin'));

	// Créer une notification pour chaque superadmin
	for (const admin of superadmins) {
		await createNotification({
			userId: admin.id,
			type: 'new_user_registered',
			title: 'Nouvel utilisateur inscrit',
			message: `L'utilisateur "${username}" vient de s'inscrire.`,
			link: `/dashboard/users`,
			metadata: {
				newUserId: userId,
				username
			}
		});
	}
}

/**
 * Crée une notification pour une erreur API (pour les superadmins)
 */
export async function notifyApiError(
	method: string,
	route: string,
	status: number,
	userId: string | null,
	username?: string | null
) {
	try {
		// Récupérer tous les superadmins
		const superadmins = await db
			.select({ id: table.user.id })
			.from(table.user)
			.where(eq(table.user.role, 'superadmin'));

		// Ne pas notifier si c'est une erreur 404 (ressource non trouvée) pour éviter le spam
		if (status === 404) {
			return;
		}

		const statusLabel = status >= 500 ? 'Erreur serveur' : status >= 400 ? 'Erreur client' : 'Erreur';
		
		// Récupérer le nom d'utilisateur si non fourni
		let finalUsername = username || 'Anonyme';
		if (!username && userId) {
			try {
				const users = await db
					.select({ username: table.user.username })
					.from(table.user)
					.where(eq(table.user.id, userId))
					.limit(1);
				finalUsername = users[0]?.username || 'Inconnu';
			} catch {
				finalUsername = 'Inconnu';
			}
		}

		// Créer une notification pour chaque superadmin
		for (const admin of superadmins) {
			await createNotification({
				userId: admin.id,
				type: 'api_error',
				title: `${statusLabel} ${status}`,
				message: `${method} ${route} - Utilisateur: ${finalUsername}`,
				link: `/dashboard/logs?q=${encodeURIComponent(route)}&errors=true`,
				metadata: {
					method,
					route,
					status,
					userId,
					username: finalUsername
				}
			}).catch((error) => {
				// Ne pas propager l'erreur si la table n'existe pas encore
				console.warn('Erreur lors de la création de la notification API:', error);
			});
		}
	} catch (error) {
		// Ne pas propager l'erreur pour éviter de bloquer la requête
		console.warn('Erreur lors de la notification d\'erreur API:', error);
	}
}

/**
 * Récupère les notifications non lues pour un utilisateur
 */
export async function getUnreadNotifications(userId: string) {
	return await db
		.select()
		.from(table.notification)
		.where(and(eq(table.notification.userId, userId), eq(table.notification.read, false)))
		.orderBy(desc(table.notification.createdAt));
}

/**
 * Récupère toutes les notifications pour un utilisateur
 */
export async function getAllNotifications(userId: string, limit = 50) {
	return await db
		.select()
		.from(table.notification)
		.where(eq(table.notification.userId, userId))
		.orderBy(desc(table.notification.createdAt))
		.limit(limit);
}

/**
 * Marque une notification comme lue
 */
export async function markNotificationAsRead(notificationId: string, userId: string) {
	await db
		.update(table.notification)
		.set({ read: true })
		.where(eq(table.notification.id, notificationId))
		.where(eq(table.notification.userId, userId));
}

/**
 * Marque toutes les notifications d'un utilisateur comme lues
 */
export async function markAllNotificationsAsRead(userId: string) {
	await db
		.update(table.notification)
		.set({ read: true })
		.where(and(eq(table.notification.userId, userId), eq(table.notification.read, false)));
}

/**
 * Compte les notifications non lues pour un utilisateur
 */
export async function countUnreadNotifications(userId: string): Promise<number> {
	const result = await db
		.select({ count: sql<number>`count(*)`.as('count') })
		.from(table.notification)
		.where(and(eq(table.notification.userId, userId), eq(table.notification.read, false)));

	return result[0]?.count || 0;
}
