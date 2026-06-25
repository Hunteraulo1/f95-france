import {
	effectiveTranslationVersion,
	isTranslationOutdatedForLinkedTranslator
} from '$lib/server/api/translation-public';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { and, desc, eq, inArray, like, or } from 'drizzle-orm';

export const DASHBOARD_MY_TRANSLATIONS_PAGE_SIZE = 20;

export type MyTranslationsFilters = {
	statusFilter: 'all' | 'in_progress' | 'completed' | 'abandoned';
	roleFilter: 'all' | 'translator' | 'proofreader';
	q: string;
};

export async function loadDashboardMyTranslationsPage(options: {
	locals: App.Locals;
	filters: MyTranslationsFilters;
	requestedPage: number;
}) {
	const { locals, filters, requestedPage } = options;
	const { statusFilter, roleFilter, q } = filters;

	const [linkedTranslator] = await db
		.select({ id: table.translator.id, name: table.translator.name })
		.from(table.translator)
		.where(eq(table.translator.userId, locals.user!.id))
		.limit(1);

	if (!linkedTranslator) {
		return {
			linkedTranslator: null,
			statusFilter,
			roleFilter,
			q,
			page: 1,
			pageSize: DASHBOARD_MY_TRANSLATIONS_PAGE_SIZE,
			totalCount: 0,
			totalPages: 1,
			staffById: {} as Record<string, { name: string; username: string | null }>,
			outdatedCount: 0,
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

	const whereSearch = q
		? like(table.game.name, `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`)
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
			translatorAlertsEnabled: table.gameTranslation.translatorAlertsEnabled,
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
			and(whereRole, ...(whereStatus ? [whereStatus] : []), ...(whereSearch ? [whereSearch] : []))
		)
		.orderBy(desc(table.gameTranslation.updatedAt));

	const translationsWithFlags = translations
		.map((t) => {
			const referenceVersion = effectiveTranslationVersion(t.version, t.game.gameVersion) ?? '';
			const isOutdated = isTranslationOutdatedForLinkedTranslator(
				{
					status: t.status,
					version: t.version,
					tversion: t.tversion,
					tname: t.tname,
					translatorId: t.translatorId,
					translatorAlertsEnabled: t.translatorAlertsEnabled,
					proofreaderId: t.proofreaderId
				},
				t.game.gameVersion,
				linkedTranslator.id
			);
			const isFollowAbandoned =
				t.translatorId === linkedTranslator.id && !t.translatorAlertsEnabled;
			const canMuteTranslatorAlerts =
				t.translatorId === linkedTranslator.id && t.translatorAlertsEnabled;
			const canResumeTranslatorAlerts = isFollowAbandoned;
			return {
				...t,
				referenceVersion,
				isOutdated,
				isFollowAbandoned,
				canMuteTranslatorAlerts,
				canResumeTranslatorAlerts
			};
		})
		.sort((a, b) => {
			if (a.isFollowAbandoned !== b.isFollowAbandoned) return a.isFollowAbandoned ? 1 : -1;
			if (a.isOutdated !== b.isOutdated) return a.isOutdated ? -1 : 1;
			return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
		});

	const totalCount = translationsWithFlags.length;
	const totalPages = Math.max(1, Math.ceil(totalCount / DASHBOARD_MY_TRANSLATIONS_PAGE_SIZE));
	const page = Math.min(requestedPage, totalPages);
	const pageItems = translationsWithFlags.slice(
		(page - 1) * DASHBOARD_MY_TRANSLATIONS_PAGE_SIZE,
		page * DASHBOARD_MY_TRANSLATIONS_PAGE_SIZE
	);

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
		pageSize: DASHBOARD_MY_TRANSLATIONS_PAGE_SIZE,
		totalCount,
		totalPages,
		staffById,
		outdatedCount: translationsWithFlags.filter((t) => t.isOutdated).length,
		translations: pageItems
	};
}
