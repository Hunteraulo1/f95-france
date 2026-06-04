import { appLogError } from '$lib/server/app-log-bridge';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { defaultGameTypeForGame, type GameEngineColumn } from '$lib/server/game-engine-type';
import { fetchSubmissionListRows, type SubmissionListRow } from '$lib/server/submission-list-query';
import { normalizeTranslationTversion } from '$lib/utils/game-form-validation';
import { asc, eq, inArray, sql, type SQL } from 'drizzle-orm';

export const SUBMISSION_PAGE_SIZE = 20;

export type SubmissionStatusFilter =
	| 'all'
	| 'pending'
	| 'opened'
	| 'to_fix'
	| 'accepted'
	| 'rejected';

export type SubmissionStatusCounts = {
	pendingCount: number;
	openedCount: number;
	toFixCount: number;
	acceptedCount: number;
	rejectedCount: number;
};

export function parseSubmissionStatusFilter(raw: string | null): SubmissionStatusFilter {
	const value = raw || 'pending';
	if (
		value === 'all' ||
		value === 'pending' ||
		value === 'opened' ||
		value === 'to_fix' ||
		value === 'accepted' ||
		value === 'rejected'
	) {
		return value;
	}
	return 'pending';
}

const normalizeMaybeString = (value: FormDataEntryValue | null): string | null => {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
};

/** Reconstruit le payload JSON depuis les champs du formulaire modal (version admin). */
export function formDataToSubmissionPayload(
	submissionType: string,
	formData: FormData
): Record<string, unknown> | null {
	const maybeTrim = (v: FormDataEntryValue | null): string =>
		typeof v === 'string' ? v.trim() : '';
	const boolFromForm = (v: FormDataEntryValue | null, defaultValue: boolean): boolean => {
		if (v === null) return defaultValue;
		if (typeof v !== 'string') return Boolean(v);
		const s = v.trim().toLowerCase();
		if (s === '' || s === 'on' || s === 'true' || s === '1' || s === 'yes') return true;
		if (s === 'false' || s === '0' || s === 'no' || s === 'off') return false;
		return defaultValue;
	};

	const buildTranslation = (): Record<string, unknown> => {
		const tname = maybeTrim(formData.get('editTranslationTname'));
		return {
			translationName: maybeTrim(formData.get('editTranslationTranslationName')) || null,
			version: maybeTrim(formData.get('editTranslationVersion')) || null,
			tversion: normalizeTranslationTversion(
				tname,
				maybeTrim(formData.get('editTranslationTversion'))
			),
			status: maybeTrim(formData.get('editTranslationStatus')),
			ttype: maybeTrim(formData.get('editTranslationTtype')),
			gameType: maybeTrim(formData.get('editTranslationGameType')),
			tlink: maybeTrim(formData.get('editTranslationTlink')) || null,
			tname,
			translatorId: maybeTrim(formData.get('editTranslationTranslatorId')) || null,
			proofreaderId: maybeTrim(formData.get('editTranslationProofreaderId')) || null,
			ac: boolFromForm(formData.get('editTranslationAc'), false)
		};
	};

	const buildGame = (): Record<string, unknown> => ({
		name: maybeTrim(formData.get('editGameName')),
		description: maybeTrim(formData.get('editGameDescription')) || null,
		website: maybeTrim(formData.get('editGameWebsite')),
		threadId: maybeTrim(formData.get('editGameThreadId')) || null,
		tags: maybeTrim(formData.get('editGameTags')) || null,
		link: maybeTrim(formData.get('editGameLink')) || null,
		image: maybeTrim(formData.get('editGameImage')),
		gameAutoCheck: boolFromForm(formData.get('editGameAutoCheck'), true),
		gameVersion: maybeTrim(formData.get('editGameGameVersion')) || null
	});

	if (submissionType === 'translator_pages') {
		const translatorId = normalizeMaybeString(formData.get('translatorId'));
		const names = formData.getAll('editTranslatorPageName').map((v) => String(v ?? '').trim());
		const links = formData.getAll('editTranslatorPageLink').map((v) => String(v ?? '').trim());
		const max = Math.max(names.length, links.length);
		const pages = Array.from({ length: max })
			.map((_, i) => ({ name: names[i] ?? '', link: links[i] ?? '' }))
			.filter((p) => p.name !== '' || p.link !== '');

		return {
			translatorId: translatorId ?? '',
			pages
		};
	}

	if (submissionType === 'translation') {
		return { translation: buildTranslation() };
	}

	if (submissionType === 'game' || submissionType === 'update') {
		const payload: Record<string, unknown> = { game: buildGame() };

		const hasAnyTranslationField =
			typeof formData.get('editTranslationTname') === 'string' ||
			typeof formData.get('editTranslationTranslationName') === 'string' ||
			typeof formData.get('editTranslationTversion') === 'string' ||
			typeof formData.get('editTranslationStatus') === 'string';
		if (hasAnyTranslationField) {
			payload.translation = buildTranslation();
		}

		return payload;
	}

	return null;
}

export async function countSubmissionStatuses(options?: {
	userId?: string;
}): Promise<SubmissionStatusCounts> {
	const baseWhere = options?.userId ? eq(table.submission.userId, options.userId) : undefined;

	const [row] = await db
		.select({
			pendingCount: sql<number>`count(*) filter (where ${table.submission.status} = 'pending')`.as(
				'pending_count'
			),
			openedCount: sql<number>`count(*) filter (where ${table.submission.status} = 'opened')`.as(
				'opened_count'
			),
			toFixCount: sql<number>`count(*) filter (where ${table.submission.status} = 'to_fix')`.as(
				'to_fix_count'
			),
			acceptedCount:
				sql<number>`count(*) filter (where ${table.submission.status} = 'accepted')`.as(
					'accepted_count'
				),
			rejectedCount:
				sql<number>`count(*) filter (where ${table.submission.status} = 'rejected')`.as(
					'rejected_count'
				)
		})
		.from(table.submission)
		.where(baseWhere);

	return {
		pendingCount: Number(row?.pendingCount ?? 0),
		openedCount: Number(row?.openedCount ?? 0),
		toFixCount: Number(row?.toFixCount ?? 0),
		acceptedCount: Number(row?.acceptedCount ?? 0),
		rejectedCount: Number(row?.rejectedCount ?? 0)
	};
}

async function batchDefaultGameTypes(gameIds: string[]): Promise<Record<string, GameEngineColumn>> {
	const uniqueIds = [...new Set(gameIds.filter(Boolean))];
	const result: Record<string, GameEngineColumn> = {};
	if (uniqueIds.length === 0) return result;

	const rows = await db
		.select({
			gameId: table.gameTranslation.gameId,
			gameType: table.gameTranslation.gameType,
			createdAt: table.gameTranslation.createdAt
		})
		.from(table.gameTranslation)
		.where(inArray(table.gameTranslation.gameId, uniqueIds))
		.orderBy(asc(table.gameTranslation.createdAt));

	for (const row of rows) {
		if (!result[row.gameId]) {
			result[row.gameId] = row.gameType;
		}
	}
	for (const id of uniqueIds) {
		if (!result[id]) result[id] = 'other';
	}
	return result;
}

function parseTranslatorPages(pagesJson: string | null): Array<{ name: string; link: string }> {
	try {
		const parsed = JSON.parse(pagesJson || '[]') as Array<{ name?: string; link?: string }>;
		if (!Array.isArray(parsed)) return [];
		return parsed.map((p) => ({
			name: String(p.name ?? ''),
			link: String(p.link ?? '')
		}));
	} catch {
		return [];
	}
}

export type EnrichedSubmissionRow = SubmissionListRow & {
	adminNotes: string | null;
	parsedData: unknown;
	currentGame: (typeof table.game.$inferSelect & { type: GameEngineColumn }) | null;
	currentTranslation: typeof table.gameTranslation.$inferSelect | null;
	currentTranslator: {
		id: string;
		name: string;
		pages: Array<{ name: string; link: string }>;
	} | null;
};

export async function enrichSubmissionListRows(
	submissions: SubmissionListRow[],
	options?: { includeAdminNotes?: boolean }
): Promise<EnrichedSubmissionRow[]> {
	if (submissions.length === 0) return [];

	const gameIds = submissions.map((s) => s.gameId).filter((id): id is string => Boolean(id));
	const translationIds = submissions
		.map((s) => s.translationId)
		.filter((id): id is string => Boolean(id));

	const translatorIds = new Set<string>();
	const parsedById = new Map<string, unknown>();

	for (const sub of submissions) {
		if (!sub.data) continue;
		try {
			const parsed = JSON.parse(sub.data) as { translatorId?: string };
			parsedById.set(sub.id, parsed);
			if (sub.type === 'translator_pages' && parsed.translatorId) {
				translatorIds.add(String(parsed.translatorId));
			}
		} catch (e) {
			appLogError('system', 'Parsing données de soumission échoué', e);
			parsedById.set(sub.id, null);
		}
	}

	const [games, translations, translators, gameTypes] = await Promise.all([
		gameIds.length > 0
			? db.select().from(table.game).where(inArray(table.game.id, gameIds))
			: Promise.resolve([]),
		translationIds.length > 0
			? db
					.select()
					.from(table.gameTranslation)
					.where(inArray(table.gameTranslation.id, translationIds))
			: Promise.resolve([]),
		translatorIds.size > 0
			? db
					.select({
						id: table.translator.id,
						name: table.translator.name,
						pages: table.translator.pages
					})
					.from(table.translator)
					.where(inArray(table.translator.id, [...translatorIds]))
			: Promise.resolve([]),
		batchDefaultGameTypes(gameIds)
	]);

	const gamesById = Object.fromEntries(games.map((g) => [g.id, g]));
	const translationsById = Object.fromEntries(translations.map((t) => [t.id, t]));
	const translatorsById = Object.fromEntries(
		translators.map((t) => [
			t.id,
			{
				id: t.id,
				name: t.name,
				pages: parseTranslatorPages(t.pages)
			}
		])
	);

	// Jeux sans traduction en base : fallback sur requête unitaire (rare).
	const missingTypeIds = gameIds.filter((id) => !gameTypes[id]);
	if (missingTypeIds.length > 0) {
		await Promise.all(
			missingTypeIds.map(async (id) => {
				gameTypes[id] = await defaultGameTypeForGame(id);
			})
		);
	}

	return submissions.map((sub) => {
		const parsedData = parsedById.get(sub.id) ?? null;
		let currentGame: EnrichedSubmissionRow['currentGame'] = null;
		let currentTranslation: EnrichedSubmissionRow['currentTranslation'] = null;
		let currentTranslator: EnrichedSubmissionRow['currentTranslator'] = null;

		if (sub.gameId && gamesById[sub.gameId]) {
			const row = gamesById[sub.gameId];
			currentGame = { ...row, type: gameTypes[sub.gameId] ?? 'other' };
		}

		if (sub.translationId && translationsById[sub.translationId]) {
			currentTranslation = translationsById[sub.translationId];
		}

		if (sub.type === 'translator_pages') {
			const translatorId =
				parsedData && typeof parsedData === 'object' && parsedData !== null
					? String((parsedData as { translatorId?: string }).translatorId ?? '')
					: '';
			if (translatorId && translatorsById[translatorId]) {
				currentTranslator = translatorsById[translatorId];
			}
		}

		return {
			...sub,
			adminNotes: options?.includeAdminNotes ? sub.adminNotes || '' : sub.adminNotes,
			parsedData,
			currentGame,
			currentTranslation,
			currentTranslator
		};
	});
}

export async function loadTranslatorsForSubmissions() {
	return db
		.select({
			id: table.translator.id,
			name: table.translator.name,
			userId: table.translator.userId,
			username: table.user.username
		})
		.from(table.translator)
		.leftJoin(table.user, eq(table.user.id, table.translator.userId));
}

export async function loadSubmissionListPage(options: {
	where?: SQL;
	statusFilter: SubmissionStatusFilter;
	requestedPage: number;
	userId?: string;
	includeAdminNotes?: boolean;
}) {
	const { where, statusFilter, requestedPage, userId, includeAdminNotes } = options;

	const [countRow] = await (where
		? db
				.select({ count: sql<number>`count(*)`.as('count') })
				.from(table.submission)
				.where(where)
		: db.select({ count: sql<number>`count(*)`.as('count') }).from(table.submission));

	const totalCount = Number(countRow?.count ?? 0);
	const totalPages = Math.max(1, Math.ceil(totalCount / SUBMISSION_PAGE_SIZE));
	const page = Math.min(requestedPage, totalPages);
	const offset = (page - 1) * SUBMISSION_PAGE_SIZE;

	const submissions = await fetchSubmissionListRows({
		where,
		limit: SUBMISSION_PAGE_SIZE,
		offset
	});

	const [submissionsWithData, statusCounts, translators] = await Promise.all([
		enrichSubmissionListRows(submissions, { includeAdminNotes }),
		countSubmissionStatuses(userId ? { userId } : undefined),
		loadTranslatorsForSubmissions()
	]);

	return {
		submissions: submissionsWithData,
		statusFilter,
		page,
		pageSize: SUBMISSION_PAGE_SIZE,
		totalCount,
		totalPages,
		...statusCounts,
		translators
	};
}
