import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { shouldNotifyTranslatorOnAutoCheckVersionBump } from '$lib/server/translation-notify-rules';
import { fail } from '@sveltejs/kit';
import { and, desc, eq, inArray, or } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw fail(401, { message: 'Non authentifié' });
	}

	// Le compte doit être lié à un traducteur (translator.userId) pour que "Mes traductions" ait du sens.
	const [linkedTranslator] = await db
		.select({ id: table.translator.id, name: table.translator.name })
		.from(table.translator)
		.where(eq(table.translator.userId, locals.user.id))
		.limit(1);

	const statusFilterRaw = (url.searchParams.get('status') ?? 'all').trim();
	const statusFilter =
		statusFilterRaw === 'in_progress' || statusFilterRaw === 'completed' || statusFilterRaw === 'abandoned'
			? statusFilterRaw
			: 'all';

	if (!linkedTranslator) {
		return {
			linkedTranslator: null,
			statusFilter,
			translations: []
		};
	}

	const whereStatus =
		statusFilter === 'all' ? undefined : eq(table.gameTranslation.status, statusFilter);

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
				or(
					eq(table.gameTranslation.translatorId, linkedTranslator.id),
					eq(table.gameTranslation.proofreaderId, linkedTranslator.id)
				),
				...(whereStatus ? [whereStatus] : [])
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

	const staffIds = Array.from(
		new Set(
			translations
				.flatMap((t) => [t.translatorId, t.proofreaderId])
				.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
		)
	);
	const staffRows = staffIds.length
		? await db
				.select({ id: table.translator.id, name: table.translator.name })
				.from(table.translator)
				.where(inArray(table.translator.id, staffIds))
		: [];
	const staffNameById = Object.fromEntries(staffRows.map((r) => [r.id, r.name]));

	return {
		linkedTranslator,
		statusFilter,
		staffNameById,
		outdatedCount: translationsWithFlags.filter((t) => t.isOutdated).length,
		translations: translationsWithFlags
	};
};
