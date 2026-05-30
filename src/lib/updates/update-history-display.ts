import { translationKindLabel } from '$lib/games/public-game-display';
import type { UpdateHistoryAction, UpdateHistoryFieldDelta } from '$lib/server/update-history';
import { getGameEngineLabel } from '$lib/utils/game-engine-colors';
import {
	getTranslationProgressLabel,
	getTranslationTypeLabel
} from '$lib/utils/game-translation-labels';

type TranslatorLookup = { id: string; name: string };

const FIELD_LABELS: Record<string, string> = {
	translationName: 'Nom de traduction',
	tname: 'Statut de la traduction',
	tversion: 'Version traduction',
	version: 'Version de référence',
	status: 'Avancement',
	gameType: 'Moteur',
	ttype: 'Type de traduction',
	tlink: 'Lien',
	ac: 'Auto-Check',
	translatorId: 'Traducteur',
	proofreaderId: 'Relecteur'
};

export function getUpdateHistoryActionLabel(action: UpdateHistoryAction): string {
	switch (action) {
		case 'created':
			return 'Traduction ajoutée';
		case 'status_changed':
			return 'Traduction modifiée';
		case 'deleted':
			return 'Traduction supprimée';
		default:
			return action;
	}
}

export function getUpdateHistoryActionBadgeClass(action: UpdateHistoryAction): string {
	switch (action) {
		case 'created':
			return 'badge-success';
		case 'status_changed':
			return 'badge-info';
		case 'deleted':
			return 'badge-error';
		default:
			return 'badge-neutral';
	}
}

export function getUpdateHistoryFieldLabel(field: string): string {
	return FIELD_LABELS[field] ?? field;
}

function getTranslatorName(translatorId: unknown, translators: TranslatorLookup[]): string | null {
	if (typeof translatorId !== 'string' || !translatorId) return null;
	return translators.find((t) => t.id === translatorId)?.name ?? null;
}

export function formatUpdateHistoryFieldValue(
	field: string,
	value: unknown,
	translators: TranslatorLookup[]
): string {
	if (value === null || value === undefined || value === '') {
		return '—';
	}

	if (field === 'translatorId' || field === 'proofreaderId') {
		return getTranslatorName(value, translators) ?? String(value);
	}

	if (field === 'status' && typeof value === 'string') {
		return getTranslationProgressLabel(value);
	}

	if (field === 'ttype' && typeof value === 'string') {
		return getTranslationTypeLabel(value);
	}

	if (field === 'tname' && typeof value === 'string') {
		return translationKindLabel(value);
	}

	if (field === 'gameType' && typeof value === 'string') {
		return getGameEngineLabel(value);
	}

	if (field === 'ac' && typeof value === 'boolean') {
		return value ? 'Activé' : 'Désactivé';
	}

	return String(value);
}

export function visibleHistoryDeltas(
	action: UpdateHistoryAction,
	deltas: UpdateHistoryFieldDelta[]
): UpdateHistoryFieldDelta[] {
	if (action === 'created') {
		return deltas.filter(
			(delta) => delta.newValue !== null && delta.newValue !== undefined && delta.newValue !== ''
		);
	}

	if (action === 'deleted') {
		return deltas.filter(
			(delta) => delta.oldValue !== null && delta.oldValue !== undefined && delta.oldValue !== ''
		);
	}

	return deltas;
}

export function resolveHistoryTranslationName(
	translationId: string,
	deltas: UpdateHistoryFieldDelta[],
	translations: Array<{ id: string; translationName: string | null }>
): string {
	const fromCurrent = translations.find((t) => t.id === translationId)?.translationName;
	if (fromCurrent?.trim()) return fromCurrent.trim();

	const fromDelta = deltas.find((d) => d.field === 'translationName');
	const candidate = fromDelta?.newValue ?? fromDelta?.oldValue;
	if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();

	return 'Traduction sans nom';
}

export function formatUpdateHistoryDate(date: Date | string): string {
	return new Date(date).toLocaleDateString('fr-FR', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}
