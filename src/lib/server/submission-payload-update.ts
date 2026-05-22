import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import {
	normalizeTranslationTversion,
	validateTranslationTversion
} from '$lib/utils/game-form-validation';
import { eq } from 'drizzle-orm';

export type SubmissionPayloadParseResult =
	| { ok: true; data: Record<string, unknown> }
	| { ok: false; message: string };

export function parseSubmissionPayloadJson(
	submissionDataJson: unknown
): SubmissionPayloadParseResult {
	if (typeof submissionDataJson !== 'string' || !submissionDataJson.trim()) {
		return { ok: false, message: 'Données de soumission requises' };
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(submissionDataJson);
	} catch {
		return { ok: false, message: 'JSON invalide' };
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		return { ok: false, message: 'JSON invalide (objet attendu)' };
	}
	return { ok: true, data: parsed as Record<string, unknown> };
}

function validateTranslationBlock(translation: unknown): string | null {
	if (!translation || typeof translation !== 'object' || Array.isArray(translation)) {
		return 'Données invalides: clé `translation` manquante';
	}
	const tr = translation as Record<string, unknown>;
	const tname = typeof tr.tname === 'string' ? tr.tname : '';
	return validateTranslationTversion(tname, typeof tr.tversion === 'string' ? tr.tversion : '');
}

/** Normalise `translation.tversion` selon `tname` avant persistance. */
export function normalizeTranslationInPayload(data: Record<string, unknown>): void {
	const tr = data.translation;
	if (!tr || typeof tr !== 'object' || Array.isArray(tr)) return;
	const row = tr as Record<string, unknown>;
	const tname = typeof row.tname === 'string' ? row.tname : '';
	row.tversion = normalizeTranslationTversion(
		tname,
		typeof row.tversion === 'string' ? row.tversion : ''
	);
}

export function validateSubmissionPayloadForType(
	type: string,
	data: Record<string, unknown>
): string | null {
	if (type === 'translator_pages') {
		if (typeof data.translatorId !== 'string' || !data.translatorId.trim()) {
			return 'Données invalides: `translatorId` manquant';
		}
		if (!Array.isArray(data.pages)) {
			return 'Données invalides: `pages` doit être un tableau';
		}
		for (const page of data.pages) {
			if (!page || typeof page !== 'object') {
				return 'Données invalides: chaque page doit être un objet';
			}
			const name = String((page as { name?: unknown }).name ?? '').trim();
			const link = String((page as { link?: unknown }).link ?? '').trim();
			if (!name || !link) {
				return 'Chaque page doit avoir un nom et un lien';
			}
		}
		return null;
	}
	if (type === 'delete') {
		const reason = String(data.reason ?? '').trim();
		if (!reason) {
			return 'La raison de la suppression est obligatoire';
		}
		return null;
	}
	if (type === 'translation') {
		return validateTranslationBlock(data.translation);
	}
	if (!('game' in data) || data.game === null) {
		return 'Données invalides: clé `game` manquante';
	}
	if ('translation' in data && data.translation != null) {
		return validateTranslationBlock(data.translation);
	}
	return null;
}

export async function persistSubmissionPayload(
	submissionId: string,
	data: Record<string, unknown>
): Promise<void> {
	normalizeTranslationInPayload(data);
	await db
		.update(table.submission)
		.set({
			data: JSON.stringify(data),
			updatedAt: new Date()
		})
		.where(eq(table.submission.id, submissionId));
}
