import {
	effectiveTranslationVersion,
	isTranslationOutdated
} from '$lib/server/api/translation-public';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { count, desc, eq, or } from 'drizzle-orm';

export const PROFILE_TRANSLATIONS_PAGE_SIZE = 20;

export type ProfileTranslationItem = {
	id: string;
	translationName: string | null;
	status: string;
	tversion: string;
	tname: string;
	ttype: string;
	tlink: string | null;
	updatedAt: Date;
	profileRole: 'translator' | 'proofreader';
	isOutdated: boolean;
	referenceVersion: string;
	game: {
		id: string;
		name: string;
		image: string | null;
		gameVersion: string | null;
	};
};

export async function loadProfileTranslationsForUser(
	userId: string,
	options?: { page?: number; pageSize?: number }
): Promise<{
	linkedTranslator: { id: string; name: string } | null;
	translations: ProfileTranslationItem[];
	totalCount: number;
	page: number;
	pageSize: number;
	totalPages: number;
}> {
	const pageSize = options?.pageSize ?? PROFILE_TRANSLATIONS_PAGE_SIZE;
	const requestedPage =
		typeof options?.page === 'number' && options.page > 0 ? Math.floor(options.page) : 1;
	const [linkedTranslator] = await db
		.select({ id: table.translator.id, name: table.translator.name })
		.from(table.translator)
		.where(eq(table.translator.userId, userId))
		.limit(1);

	if (!linkedTranslator) {
		return {
			linkedTranslator: null,
			translations: [],
			totalCount: 0,
			page: 1,
			pageSize,
			totalPages: 1
		};
	}

	const roleFilter = or(
		eq(table.gameTranslation.translatorId, linkedTranslator.id),
		eq(table.gameTranslation.proofreaderId, linkedTranslator.id)
	);

	const [countRow] = await db
		.select({ count: count() })
		.from(table.gameTranslation)
		.where(roleFilter);

	const totalCount = Number(countRow?.count ?? 0);
	const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
	const page = Math.min(requestedPage, totalPages);

	const rows = await db
		.select({
			id: table.gameTranslation.id,
			translationName: table.gameTranslation.translationName,
			status: table.gameTranslation.status,
			version: table.gameTranslation.version,
			tversion: table.gameTranslation.tversion,
			tname: table.gameTranslation.tname,
			ttype: table.gameTranslation.ttype,
			tlink: table.gameTranslation.tlink,
			updatedAt: table.gameTranslation.updatedAt,
			translatorId: table.gameTranslation.translatorId,
			proofreaderId: table.gameTranslation.proofreaderId,
			game: {
				id: table.game.id,
				name: table.game.name,
				image: table.game.image,
				gameVersion: table.game.gameVersion
			}
		})
		.from(table.gameTranslation)
		.innerJoin(table.game, eq(table.game.id, table.gameTranslation.gameId))
		.where(roleFilter)
		.orderBy(desc(table.gameTranslation.updatedAt))
		.offset((page - 1) * pageSize)
		.limit(pageSize);

	const translations: ProfileTranslationItem[] = rows.map((t) => ({
		id: t.id,
		translationName: t.translationName,
		status: t.status,
		tversion: t.tversion,
		tname: t.tname,
		ttype: t.ttype,
		tlink: t.tlink,
		updatedAt: t.updatedAt,
		profileRole:
			t.translatorId === linkedTranslator.id ? ('translator' as const) : ('proofreader' as const),
		isOutdated: isTranslationOutdated(
			{ version: t.version, tversion: t.tversion, tname: t.tname },
			t.game.gameVersion
		),
		referenceVersion: effectiveTranslationVersion(t.version, t.game.gameVersion) ?? '',
		game: t.game
	}));

	return {
		linkedTranslator: { id: linkedTranslator.id, name: linkedTranslator.name },
		translations,
		totalCount,
		page,
		pageSize,
		totalPages
	};
}
