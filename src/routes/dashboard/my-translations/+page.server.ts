import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { shouldNotifyTranslatorOnAutoCheckVersionBump } from '$lib/server/translation-notify-rules';
import { fail } from '@sveltejs/kit';
import { and, desc, eq, ilike, inArray, or } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

const FILTER_COOKIE_PATH = '/dashboard/my-translations';
const FILTER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 an
const PAGE_SIZE = 20;

export const load: PageServerLoad = async ({ locals, url, cookies }) => {
	if (!locals.user) {
		throw fail(401, { message: 'Non authentifié' });
	}

	// Le compte doit être lié à un traducteur (translator.userId) pour que "Mes traductions" ait du sens.
	const [linkedTranslator] = await db
		.select({ id: table.translator.id, name: table.translator.name })
		.from(table.translator)
		.where(eq(table.translator.userId, locals.user.id))
		.limit(1);

	const statusFilterRaw = (
		url.searchParams.get('status') ??
		cookies.get('mt_status') ??
		'all'
	).trim();
	const statusFilter =
		statusFilterRaw === 'in_progress' ||
		statusFilterRaw === 'completed' ||
		statusFilterRaw === 'abandoned'
			? statusFilterRaw
			: 'all';

	const roleFilterRaw = (
		url.searchParams.get('role') ??
		cookies.get('mt_role') ??
		'all'
	).trim();
	const roleFilter =
		roleFilterRaw === 'translator' || roleFilterRaw === 'proofreader' ? roleFilterRaw : 'all';

	const cookieOptions = {
		path: FILTER_COOKIE_PATH,
		maxAge: FILTER_COOKIE_MAX_AGE,
		sameSite: 'lax' as const,
		httpOnly: false
	};
	cookies.set('mt_status', statusFilter, cookieOptions);
	cookies.set('mt_role', roleFilter, cookieOptions);

	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
	const pageRaw = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
	const requestedPage = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

	if (!linkedTranslator) {
		return {
			linkedTranslator: null,
			statusFilter,
			roleFilter,
			q,
			page: 1,
			pageSize: PAGE_SIZE,
			totalCount: 0,
			totalPages: 1,
			translations: []
		};
	}

	const whereStatus =
		statusFilter === 'all' ? undefined : eq(table.gameTranslation.status, statusFilter);

	const whereRole =
		roleFilter === 'translator'
			? eq(table.gameTranslation.translatorId, linkedTranslator.id)
			: roleFilter === 'proofreader'
				? eq(table.gameTranslation.proofreaderId, linkedTranslator.id)
				: or(
						eq(table.gameTranslation.translatorId, linkedTranslator.id),
						eq(table.gameTranslation.proofreaderId, linkedTranslator.id)
					);

	// Échappe les jokers SQL dans le terme de recherche pour utiliser ilike littéralement.
	const whereSearch = q
		? ilike(table.game.name, `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`)
		: undefined;

	const translations = await db
		.select({
			id: table.gameTranslation.id,
			translationName: table.gameTranslation.translationName,
			status: table.gameTranslation.status,
			version: table.gameTranslation.version,
			tversion: table.gameTranslation.tversion,
			tname: table.gameTranslation.tname,
			ttype: table.gameTranslation.ttype,
			tlink: table.gameTranslation.tlink,
			ac: table.gameTranslation.ac,
			updatedAt: table.gameTranslation.updatedAt,
			translatorId: table.gameTranslation.translatorId,
			proofreaderId: table.gameTranslation.proofreaderId,
			game: {
				id: table.game.id,
				name: table.game.name,
				image: table.game.image,
				website: table.game.website,
				gameVersion: table.game.gameVersion
			}
		})
		.from(table.gameTranslation)
		.innerJoin(table.game, eq(table.game.id, table.gameTranslation.gameId))
		.where(
			and(
				whereRole,
				...(whereStatus ? [whereStatus] : []),
				...(whereSearch ? [whereSearch] : [])
			)
		)
		.orderBy(desc(table.gameTranslation.updatedAt));

	const translationsWithFlags = translations
		.map((t) => {
			const gameVersion = typeof t.game.gameVersion === 'string' ? t.game.gameVersion.trim() : '';
			const isOutdated =
				gameVersion.length > 0 &&
				shouldNotifyTranslatorOnAutoCheckVersionBump(
					{
						version: t.version,
						tversion: t.tversion,
						tname: t.tname
					},
					gameVersion
				);
			return {
				...t,
				isOutdated
			};
		})
		.sort((a, b) => {
			if (a.isOutdated !== b.isOutdated) return a.isOutdated ? -1 : 1;
			return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
		});

	const totalCount = translationsWithFlags.length;
	const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
	const page = Math.min(requestedPage, totalPages);
	const pageItems = translationsWithFlags.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

	const staffIds = Array.from(
		new Set(
			pageItems
				.flatMap((t) => [t.translatorId, t.proofreaderId])
				.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
		)
	);
	const staffRows = staffIds.length
		? await db
				.select({
					id: table.translator.id,
					name: table.translator.name,
					username: table.user.username
				})
				.from(table.translator)
				.leftJoin(table.user, eq(table.user.id, table.translator.userId))
				.where(inArray(table.translator.id, staffIds))
		: [];
	const staffById = Object.fromEntries(
		staffRows.map((r) => [r.id, { name: r.name, username: r.username ?? null }])
	);

	return {
		linkedTranslator,
		statusFilter,
		roleFilter,
		q,
		page,
		pageSize: PAGE_SIZE,
		totalCount,
		totalPages,
		staffById,
		outdatedCount: translationsWithFlags.filter((t) => t.isOutdated).length,
		translations: pageItems
	};
};
