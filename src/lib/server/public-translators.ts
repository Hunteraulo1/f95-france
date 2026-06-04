import { parseTranslatorPages } from '$lib/profile/custom-profile';
import { db } from '$lib/server/db';
import { translator, user } from '$lib/server/db/schema';
import {
	translatorReadCountExpr,
	translatorTradCountExpr
} from '$lib/server/translator-activity-counts';
import { profilePublicHref } from '$lib/utils/profile-url';
import { count, desc, eq, ilike, or, sql } from 'drizzle-orm';

export const PUBLIC_TRANSLATORS_PAGE_SIZE = 20;

export type PublicTranslatorRow = {
	id: string;
	name: string;
	avatar: string | null;
	profileHref: `/profile/${string}` | null;
	subtitle: string;
	pages: { label: string; url: string }[];
};

function formatActivitySubtitle(tradCount: number, readCount: number): string {
	const parts: string[] = [];
	if (tradCount > 0) {
		parts.push(`${tradCount} traduction${tradCount > 1 ? 's' : ''}`);
	}
	if (readCount > 0) {
		parts.push(`${readCount} relecture${readCount > 1 ? 's' : ''}`);
	}
	return parts.length > 0 ? parts.join(' · ') : 'Traducteur';
}

function escapeIlike(value: string): string {
	return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

export type PublicTranslatorsListParams = {
	query?: string;
	page?: number;
};

export async function listPublicTranslators(params: PublicTranslatorsListParams = {}) {
	const q = params.query?.trim().slice(0, 100) ?? '';
	const page = Math.max(1, params.page ?? 1);
	const where = q ? or(ilike(translator.name, `%${escapeIlike(q)}%`)) : undefined;

	const [{ total: totalRaw }] = await db.select({ total: count() }).from(translator).where(where);
	const total = Number(totalRaw ?? 0);
	const totalPages = Math.max(1, Math.ceil(total / PUBLIC_TRANSLATORS_PAGE_SIZE));
	const safePage = Math.min(page, totalPages);
	const offset = (safePage - 1) * PUBLIC_TRANSLATORS_PAGE_SIZE;

	const rows = await db
		.select({
			id: translator.id,
			name: translator.name,
			pages: translator.pages,
			username: user.username,
			avatar: user.avatar,
			tradCount: translatorTradCountExpr().as('tradCount'),
			readCount: translatorReadCountExpr().as('readCount')
		})
		.from(translator)
		.leftJoin(user, eq(translator.userId, user.id))
		.where(where)
		.orderBy(desc(sql`${translatorReadCountExpr()} + ${translatorTradCountExpr()}`))
		.limit(PUBLIC_TRANSLATORS_PAGE_SIZE)
		.offset(offset);

	const translators: PublicTranslatorRow[] = rows.map((row) => {
		const tradCount = Number(row.tradCount ?? 0);
		const readCount = Number(row.readCount ?? 0);
		const username = row.username?.trim() ?? '';
		const avatar = row.avatar?.trim() ?? '';

		return {
			id: row.id,
			name: row.name?.trim() || 'Sans nom',
			avatar: avatar || null,
			profileHref: username ? profilePublicHref(username) : null,
			subtitle: formatActivitySubtitle(tradCount, readCount),
			pages: parseTranslatorPages(row.pages)
		};
	});

	return {
		translators,
		total,
		page: safePage,
		pageSize: PUBLIC_TRANSLATORS_PAGE_SIZE,
		totalPages,
		query: q
	};
}
