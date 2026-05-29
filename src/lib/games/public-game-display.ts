import { getGameEngineLabel } from '$lib/utils/game-engine-colors';
import {
	getTranslationProgressLabel,
	getTranslationTypeLabel
} from '$lib/utils/game-translation-labels';

export function splitGameTags(raw: string | null | undefined): string[] {
	return (raw ?? '')
		.split(',')
		.map((t) => t.trim())
		.filter(Boolean);
}

export function websiteLabel(website: string): string {
	switch (website) {
		case 'f95z':
			return 'F95Zone';
		case 'lc':
			return 'LewdCorner';
		default:
			return 'Autre';
	}
}

export function translationStatusBadgeClass(status: string): string {
	switch (status) {
		case 'completed':
			return 'badge badge-success badge-soft';
		case 'in_progress':
			return 'badge badge-info badge-soft';
		case 'abandoned':
			return 'badge badge-warning badge-soft';
		default:
			return 'badge badge-neutral badge-soft';
	}
}

export function translationKindLabel(tname: string): string {
	switch (tname) {
		case 'integrated':
			return 'Intégrée';
		case 'no_translation':
			return 'Pas de traduction';
		case 'translation_with_mods':
			return 'Traduction (mods)';
		default:
			return 'Traduction';
	}
}

export function translationTypeDisplayLabel(ttype: string): string {
	return getTranslationTypeLabel(ttype);
}

export function engineDisplayLabel(gameType: string): string {
	return getGameEngineLabel(gameType);
}

export function progressDisplayLabel(status: string): string {
	return getTranslationProgressLabel(status);
}

export function translationVersionSyncLabel(isOutdated: boolean, isIntegrated: boolean): string {
	if (isIntegrated) return 'Intégrée';
	if (isOutdated) return 'Pas à jour';
	return 'À jour';
}

export function translationVersionSyncBadgeClass(
	isOutdated: boolean,
	isIntegrated: boolean
): string {
	if (isIntegrated) return 'badge badge-neutral badge-soft';
	if (isOutdated) return 'badge badge-warning badge-soft';
	return 'badge badge-success badge-soft';
}
