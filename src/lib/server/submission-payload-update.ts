import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import {
	gameImageRequiredForWebsite,
	normalizeGameImageForStorage,
	normalizeTranslationTversion,
	validateTranslationTversion
} from '$lib/utils/game-form-validation';
import {
	validateGameLinkFields,
	validateTranslationLinkField,
	validateTranslatorPageLinks
} from '$lib/utils/link-validation';
import { eq } from 'drizzle-orm';

export type SubmissionPayloadParseResult =
	{ ok: true; data: Record<string, unknown> } | { ok: false; message: string };

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
		}
		return validateTranslatorPageLinks(data.pages as Array<{ name?: string; link?: string }>);
	}
	if (type === 'delete') {
		const reason = String(data.reason ?? '').trim();
		if (!reason) {
			return 'La raison de la suppression est obligatoire';
		}
		return null;
	}
	if (type === 'translation') {
		const versionError = validateTranslationBlock(data.translation);
		if (versionError) return versionError;
		const tr = data.translation as Record<string, unknown>;
		return validateTranslationLinkField({
			tlink: tr.tlink,
			tname: typeof tr.tname === 'string' ? tr.tname : ''
		});
	}
	if (!('game' in data) || data.game === null) {
		return 'Données invalides: clé `game` manquante';
	}
	const game = data.game as Record<string, unknown>;
	const website = typeof game.website === 'string' ? game.website : '';
	const gameAutoCheck = typeof game.gameAutoCheck === 'boolean' ? game.gameAutoCheck : undefined;
	const storedImage = normalizeGameImageForStorage(website, game.image, { gameAutoCheck });
	game.image = storedImage;
	const requireImage = gameImageRequiredForWebsite(website, { gameAutoCheck });
	const gameLinkError = validateGameLinkFields({
		link: game.link,
		image: storedImage,
		requireLink: true,
		requireImage
	});
	if (gameLinkError) return gameLinkError;

	if ('translation' in data && data.translation != null) {
		const versionError = validateTranslationBlock(data.translation);
		if (versionError) return versionError;
		const tr = data.translation as Record<string, unknown>;
		return validateTranslationLinkField({
			tlink: tr.tlink,
			tname: typeof tr.tname === 'string' ? tr.tname : ''
		});
	}
	return null;
}

export async function persistSubmissionPayload(
	submissionId: string,
	data: Record<string, unknown>
): Promise<void> {
	normalizeTranslationInPayload(data);

	const [sub] = await db
		.select({
			gameId: table.submission.gameId,
			translationId: table.submission.translationId
		})
		.from(table.submission)
		.where(eq(table.submission.id, submissionId))
		.limit(1);

	const enriched: Record<string, unknown> = { ...data };
	if (sub?.gameId && typeof enriched.gameId !== 'string') {
		enriched.gameId = sub.gameId;
	}
	if (sub?.translationId && typeof enriched.translationId !== 'string') {
		enriched.translationId = sub.translationId;
	}

	await db
		.update(table.submission)
		.set({
			data: JSON.stringify(enriched),
			updatedAt: new Date()
		})
		.where(eq(table.submission.id, submissionId));
}
