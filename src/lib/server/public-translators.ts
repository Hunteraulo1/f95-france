import { parseTranslatorPages } from '$lib/profile/custom-profile';
import { db } from '$lib/server/db';
import { translator, user } from '$lib/server/db/schema';
import {
	translatorReadCountExpr,
	translatorTradCountExpr
} from '$lib/server/translator-activity-counts';
import { profilePublicHref } from '$lib/utils/profile-url';
import { desc, eq, ilike, or, sql } from 'drizzle-orm';

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

export async function listPublicTranslators(query?: string): Promise<PublicTranslatorRow[]> {
	const q = query?.trim().slice(0, 100) ?? '';

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
		.where(q ? or(ilike(translator.name, `%${escapeIlike(q)}%`)) : undefined)
		.orderBy(desc(sql`${translatorReadCountExpr()} + ${translatorTradCountExpr()}`));

	return rows.map((row) => {
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
}
