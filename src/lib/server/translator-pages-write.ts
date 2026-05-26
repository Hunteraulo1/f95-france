import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import {
	assertDirectGameWriteAllowed,
	loadCurrentUserOrThrow,
	parseRequestDirectMode,
	resolveGameWriteMode,
	type GameWriteModeParams
} from '$lib/server/game-manage-guard';
import {
	syncTranslatorLinksInJeuxSheet,
	syncTranslatorToGoogleSheet
} from '$lib/server/google-sheets-sync';
import type { RequestEvent } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';

export type TranslatorPageEntry = { name: string; link: string };

/** Sans `games.manage` : toujours soumission ; sinon même règle que les jeux/traductions. */
export async function resolveTranslatorPagesWriteMode(
	params: GameWriteModeParams & { hasGamesManage: boolean }
): Promise<'submission' | 'direct'> {
	if (!params.hasGamesManage) {
		return 'submission';
	}
	return resolveGameWriteMode(params);
}

export function parseTranslatorPagesFormPayload(pagesRaw: string):
	| {
			ok: true;
			pages: TranslatorPageEntry[];
	  }
	| {
			ok: false;
			message: string;
	  } {
	let pagesParsed: TranslatorPageEntry[] = [];
	try {
		const raw = JSON.parse(pagesRaw) as Array<{ name?: string; link?: string }>;
		if (Array.isArray(raw)) {
			pagesParsed = raw
				.map((p) => ({
					name: String(p.name ?? '').trim(),
					link: String(p.link ?? '').trim()
				}))
				.filter((p) => p.name !== '' || p.link !== '');
		}
	} catch {
		return { ok: false, message: 'Format des pages invalide' };
	}

	if (pagesParsed.some((p) => !p.name || !p.link)) {
		return { ok: false, message: 'Chaque page doit avoir un nom et un lien.' };
	}

	return { ok: true, pages: pagesParsed };
}

async function assertLinkedTranslator(
	translatorId: string,
	userId: string
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
	const [translatorRow] = await db
		.select({
			id: table.translator.id,
			userId: table.translator.userId
		})
		.from(table.translator)
		.where(eq(table.translator.id, translatorId))
		.limit(1);

	if (!translatorRow || translatorRow.userId !== userId) {
		return {
			ok: false,
			status: 403,
			message: 'Vous pouvez modifier uniquement votre profil traducteur lié.'
		};
	}
	return { ok: true };
}

/** Applique les pages en base et synchronise les feuilles Google. */
export async function applyTranslatorPagesDirect(
	translatorId: string,
	pages: TranslatorPageEntry[]
): Promise<void> {
	await db
		.update(table.translator)
		.set({ pages: JSON.stringify(pages), updatedAt: new Date() })
		.where(eq(table.translator.id, translatorId));

	await syncTranslatorToGoogleSheet(translatorId);
	await syncTranslatorLinksInJeuxSheet(translatorId);
}

export async function createTranslatorPagesSubmission(
	userId: string,
	translatorId: string,
	pages: TranslatorPageEntry[]
): Promise<void> {
	await db.insert(table.submission).values({
		userId,
		type: 'translator_pages',
		status: 'pending',
		data: JSON.stringify({
			translatorId,
			pages
		})
	});
}

export type TranslatorPagesUpdateSuccess = {
	ok: true;
	message: string;
	mode: 'direct' | 'submission';
};

export type TranslatorPagesUpdateFailure = {
	ok: false;
	status: number;
	message: string;
};

/**
 * Enregistrement des pages traducteur (profil / page traducteurs non-admin) :
 * direct ou soumission selon le `edit_mode` du rôle (si `games.manage`).
 */
export async function handleTranslatorPagesUpdate(
	event: Pick<RequestEvent, 'request' | 'locals'>,
	options: { hasGamesManage: boolean }
): Promise<TranslatorPagesUpdateSuccess | TranslatorPagesUpdateFailure> {
	const { request, locals } = event;
	if (!locals.user) {
		return { ok: false, status: 401, message: 'Non authentifié' };
	}

	const formData = await request.formData();
	const translatorId = String(formData.get('translatorId') ?? '').trim();
	const pagesRaw = String(formData.get('pages') ?? '');
	if (!translatorId) {
		return { ok: false, status: 400, message: 'Traducteur introuvable' };
	}

	const parsed = parseTranslatorPagesFormPayload(pagesRaw);
	if (!parsed.ok) {
		return { ok: false, status: 400, message: parsed.message };
	}

	const ownership = await assertLinkedTranslator(translatorId, locals.user.id);
	if (!ownership.ok) {
		return { ok: false, status: ownership.status, message: ownership.message };
	}

	const currentUser = await loadCurrentUserOrThrow(locals.user.id);
	const writeModeParams: GameWriteModeParams = {
		roleSlug: currentUser.role,
		userDirectMode: currentUser.directMode ?? true,
		requestDirectMode: parseRequestDirectMode(formData.get('directMode'))
	};

	const writeMode = await resolveTranslatorPagesWriteMode({
		...writeModeParams,
		hasGamesManage: options.hasGamesManage
	});

	if (writeMode === 'direct') {
		await assertDirectGameWriteAllowed(writeModeParams);
		await applyTranslatorPagesDirect(translatorId, parsed.pages);
		return {
			ok: true,
			mode: 'direct',
			message: 'Pages traducteur mises à jour.'
		};
	}

	await createTranslatorPagesSubmission(locals.user.id, translatorId, parsed.pages);
	return {
		ok: true,
		mode: 'submission',
		message: 'Demande envoyée. Un admin doit la valider.'
	};
}
