import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getAllNotifications,
	getUnreadNotifications,
	markNotificationAsRead,
	markAllNotificationsAsRead,
	countUnreadNotifications
} from '$lib/server/notifications';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Non authentifié' }, { status: 401 });
	}

	try {
		const notifications = await getAllNotifications(locals.user.id);
		const unreadCount = await countUnreadNotifications(locals.user.id);

		return json({
			notifications: notifications.map((n) => ({
				...n,
				metadata: n.metadata ? JSON.parse(n.metadata) : null
			})),
			unreadCount
		});
	} catch (error: unknown) {
		// Si la table n'existe pas encore, retourner des valeurs vides
		if (
			error &&
			typeof error === 'object' &&
			'cause' in error &&
			error.cause &&
			typeof error.cause === 'object' &&
			'code' in error.cause &&
			error.cause.code === 'ER_NO_SUCH_TABLE'
		) {
			return json({
				notifications: [],
				unreadCount: 0
			});
		}
		console.error('Erreur lors de la récupération des notifications:', error);
		return json({ error: 'Erreur serveur' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Non authentifié' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const { action, notificationId } = body;

		if (action === 'markAsRead' && notificationId) {
			await markNotificationAsRead(notificationId, locals.user.id);
			return json({ success: true });
		}

		if (action === 'markAllAsRead') {
			await markAllNotificationsAsRead(locals.user.id);
			return json({ success: true });
		}

		return json({ error: 'Action invalide' }, { status: 400 });
	} catch (error: unknown) {
		// Si la table n'existe pas encore, retourner un succès silencieux
		if (
			error &&
			typeof error === 'object' &&
			'cause' in error &&
			error.cause &&
			typeof error.cause === 'object' &&
			'code' in error.cause &&
			error.cause.code === 'ER_NO_SUCH_TABLE'
		) {
			return json({ success: true });
		}
		console.error('Erreur lors de la mise à jour des notifications:', error);
		return json({ error: 'Erreur serveur' }, { status: 500 });
	}
};
