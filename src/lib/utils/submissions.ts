import { CircleCheck, CircleX, Clock } from '@lucide/svelte';

export const getStatusBadge = (status: string) => {
	switch (status) {
		case 'pending':
			return { label: 'En attente', class: 'badge-warning', icon: Clock };
		case 'accepted':
			return { label: 'Acceptée', class: 'badge-success', icon: CircleCheck };
		case 'rejected':
			return { label: 'Refusée', class: 'badge-error', icon: CircleX };
		default:
			return { label: status, class: 'badge-neutral', icon: Clock };
	}
};

export const getTypeLabel = (type: string) => {
	switch (type) {
		case 'game':
			return 'Jeu';
		case 'translation':
			return 'Traduction';
		case 'update':
			return 'Mise à jour';
		case 'delete':
			return 'Suppression';
		default:
			return type;
	}
};

export const getTypeBadge = (type: string, translationId?: string | null) => {
	const badgeMap: Record<string, string> = {
		delete: 'badge-error',
		game: 'badge-success',
		update: 'badge-warning'
	};

	if (type === 'translation') {
		return translationId ? 'badge-warning' : 'badge-info';
	}

	return badgeMap[type] || 'badge-outline';
};

export const formatDate = (date: Date | string) => {
	return new Date(date).toLocaleDateString('fr-FR', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
};

export const validateStatusChange = (status: string, notes: string): string | null => {
	if (status === 'rejected' && (!notes || notes.trim() === '')) {
		return 'Une note admin est obligatoire pour refuser une soumission';
	}
	return null;
};

export const getStatusFilterLabel = (status: string): string => {
	const labels: Record<string, string> = {
		pending: 'en attente',
		accepted: 'acceptée',
		rejected: 'refusée'
	};
	return labels[status] || '';
};
