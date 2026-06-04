import type {
  GameSubmissionJson,
  SubmissionFieldConfig,
  SubmissionModalTranslator,
  SubmissionPrimitive
} from '$lib/components/dashboard/submissions/submission-modal-types';
import type { GameTranslation } from '$lib/server/db/schema';

export const GAME_FIELDS: SubmissionFieldConfig<GameSubmissionJson>[] = [
	{ key: 'name', label: 'Nom' },
	{ key: 'description', label: 'Description', options: { isMultiline: true, showIfEmpty: true } },
	{ key: 'website', label: 'Site web' },
	{ key: 'threadId', label: 'Thread ID', options: { showIfEmpty: true } },
	{ key: 'tags', label: 'Tags', options: { isMultiline: true, showIfEmpty: true } },
	{ key: 'link', label: 'Lien', options: { isUrl: true, showIfEmpty: true } },
	{ key: 'image', label: 'Image', options: { isUrl: true } },
	{ key: 'gameVersion', label: 'Version jeu', options: { showIfEmpty: true } }
];

export const TRANSLATION_FIELDS: SubmissionFieldConfig<GameTranslation>[] = [
	{ key: 'translationName', label: 'Nom de traduction' },
	{ key: 'tname', label: 'Status de la traduction', options: { showIfEmpty: true } },
	{ key: 'tversion', label: 'Version traduction' },
	{ key: 'version', label: 'Version de référence', options: { showIfEmpty: true } },
	{ key: 'status', label: 'Statut' },
	{ key: 'gameType', label: 'Moteur (ligne)' },
	{ key: 'ttype', label: 'Type de traduction' },
	{ key: 'tlink', label: 'Lien', options: { isUrl: true } },
	{ key: 'ac', label: 'Auto-Check' },
	{ key: 'translatorId', label: 'Traducteur', options: { showIfEmpty: true } },
	{ key: 'proofreaderId', label: 'Relecteur', options: { showIfEmpty: true } }
];

export const getFieldValue = <T extends object>(
	obj: T,
	key: Extract<keyof T, string>
): SubmissionPrimitive => {
	const value: unknown = obj[key];
	return typeof value === 'string' ||
		typeof value === 'number' ||
		typeof value === 'boolean' ||
		value === null ||
		value === undefined
		? value
		: undefined;
};

const normalizeValueForComparison = (
	value: SubmissionPrimitive,
	fieldKey?: string
): string | number | boolean | null => {
	if (value === null || value === undefined) {
		return null;
	}

	if (fieldKey === 'threadId') {
		if (typeof value === 'string') {
			const trimmed = value.trim();
			if (trimmed === '') return null;
			const numericThreadId = Number(trimmed);
			return Number.isNaN(numericThreadId) ? trimmed : numericThreadId;
		}
		if (typeof value === 'number' && !Number.isNaN(value)) {
			return value;
		}
	}

	return value;
};

export const valuesAreEqual = (
	oldValue: SubmissionPrimitive,
	newValue: SubmissionPrimitive,
	fieldKey?: string
): boolean => {
	const normalizedOld = normalizeValueForComparison(oldValue, fieldKey);
	const normalizedNew = normalizeValueForComparison(newValue, fieldKey);

	if (normalizedOld === null && normalizedNew === null) {
		return true;
	}

	if (normalizedOld === null || normalizedNew === null) {
		return false;
	}

	return String(normalizedOld) === String(normalizedNew);
};

export const getTranslatorName = (
	translatorId: unknown,
	translators: SubmissionModalTranslator[]
): string | null => {
	if (typeof translatorId !== 'string' || !translatorId) return null;
	const translator = translators.find((t) => t.id === translatorId);
	return translator?.name || null;
};

export const formatFieldValue = (
	value: SubmissionPrimitive,
	showIfEmpty: boolean,
	key: string | undefined,
	translators: SubmissionModalTranslator[]
): string => {
	const isEmpty = value === null || value === undefined || value === '';
	if (isEmpty) {
		return showIfEmpty ? '(aucun)' : '';
	}

	if (key === 'translatorId' || key === 'proofreaderId') {
		const translatorName = getTranslatorName(value, translators);
		return translatorName || String(value);
	}

	if (key === 'gameType' && typeof value === 'string') {
		const labels: Record<string, string> = {
			renpy: "Ren'Py",
			rpgm: 'RPGM',
			unity: 'Unity',
			unreal: 'Unreal',
			flash: 'Flash',
			html: 'HTML',
			qsp: 'QSP',
			other: 'Autre'
		};
		return labels[value] ?? value;
	}

	if (typeof value === 'boolean') {
		return value ? 'Oui' : 'Non';
	}

	return String(value);
};

export const normalizeTranslatorPages = (
	pages: Array<{ name?: string; link?: string }> | string | null | undefined
): Array<{ name: string; link: string }> => {
	let source: Array<{ name?: string; link?: string }> = [];

	if (Array.isArray(pages)) {
		source = pages;
	} else if (typeof pages === 'string' && pages.trim() !== '') {
		try {
			const parsed = JSON.parse(pages) as unknown;
			if (Array.isArray(parsed)) {
				source = parsed as Array<{ name?: string; link?: string }>;
			}
		} catch {
			source = [];
		}
	}

	return source.map((p) => ({
		name: String(p.name ?? '').trim(),
		link: String(p.link ?? '').trim()
	}));
};
