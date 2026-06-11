import CircleCheck from '@lucide/svelte/icons/circle-check';
import CircleX from '@lucide/svelte/icons/circle-x';
import Clock from '@lucide/svelte/icons/clock';

/** Statuts encore en cours de traitement (comptés comme « en attente » sur le profil). */
export const SUBMISSION_IN_PROGRESS_STATUSES = ['pending', 'opened', 'to_fix'] as const;

export function isSubmissionInProgress(status: string): boolean {
	return (SUBMISSION_IN_PROGRESS_STATUSES as readonly string[]).includes(status);
}

export const getStatusBadge = (status: string) => {
	switch (status) {
		case 'pending':
			return { label: 'En attente', class: 'badge-warning', icon: Clock };
		case 'opened':
			return { label: 'Ouverte', class: 'badge-info', icon: Clock };
		case 'to_fix':
			return { label: 'À corriger', class: 'badge-secondary', icon: Clock };
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
		case 'translator_pages':
			return 'Pages traducteur';
		default:
			return type;
	}
};

export const getTypeBadge = (type: string, translationId?: string | null) => {
	const badgeMap: Record<string, string> = {
		delete: 'badge-error',
		game: 'badge-success',
		update: 'badge-warning',
		translator_pages: 'badge-info'
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
	if ((status === 'rejected' || status === 'to_fix') && (!notes || notes.trim() === '')) {
		return status === 'to_fix'
			? 'Une note admin est obligatoire pour demander une correction'
			: 'Une note admin est obligatoire pour refuser une soumission';
	}
	return null;
};

export const getStatusFilterLabel = (status: string): string => {
	const labels: Record<string, string> = {
		all: '',
		pending: 'en attente',
		opened: 'ouverte',
		to_fix: 'à corriger',
		accepted: 'acceptée',
		rejected: 'refusée'
	};
	return labels[status] ?? '';
};
