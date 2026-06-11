import { isTranslationOutdatedForLinkedTranslator } from '$lib/server/api/translation-public';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { isSubmissionInProgress } from '$lib/utils/submissions';
import { count, eq, or } from 'drizzle-orm';

export type ProfileStats = {
	/** Compteurs persistants (actions directes sur les fiches jeux). */
	direct: {
		gamesAdded: number;
		gamesEdited: number;
	};
	/** Soumissions créées par l'utilisateur. */
	submissions: {
		total: number;
		pending: number;
		accepted: number;
		rejected: number;
		acceptedByType: {
			game: number;
			translation: number;
			update: number;
			delete: number;
			translator_pages: number;
			other: number;
		};
	};
	/** Traductions liées au profil traducteur du compte (null si pas de fiche liée). */
	translations: {
		total: number;
		asTranslator: number;
		asProofreader: number;
		inProgress: number;
		completed: number;
		abandoned: number;
		upToDate: number;
		outdated: number;
	} | null;
};

const emptySubmissionByType = () => ({
	game: 0,
	translation: 0,
	update: 0,
	delete: 0,
	translator_pages: 0,
	other: 0
});

export async function loadProfileStats(userId: string): Promise<ProfileStats> {
	const [[userRow], submissionRows, translatorRows] = await Promise.all([
		db
			.select({
				gameAdd: table.user.gameAdd,
				gameEdit: table.user.gameEdit
			})
			.from(table.user)
			.where(eq(table.user.id, userId))
			.limit(1),
		db
			.select({
				type: table.submission.type,
				status: table.submission.status,
				total: count()
			})
			.from(table.submission)
			.where(eq(table.submission.userId, userId))
			.groupBy(table.submission.type, table.submission.status),
		db
			.select({ id: table.translator.id })
			.from(table.translator)
			.where(eq(table.translator.userId, userId))
			.limit(1)
	]);

	const submissions = {
		total: 0,
		pending: 0,
		accepted: 0,
		rejected: 0,
		acceptedByType: emptySubmissionByType()
	};

	for (const row of submissionRows) {
		const n = Number(row.total ?? 0);
		submissions.total += n;
		if (isSubmissionInProgress(row.status)) submissions.pending += n;
		else if (row.status === 'accepted') {
			submissions.accepted += n;
			const type = row.type as keyof typeof submissions.acceptedByType;
			if (type in submissions.acceptedByType) {
				submissions.acceptedByType[type] += n;
			} else {
				submissions.acceptedByType.other += n;
			}
		} else if (row.status === 'rejected') {
			submissions.rejected += n;
		}
	}

	let translations: ProfileStats['translations'] = null;

	const translatorRow = translatorRows[0];
	if (translatorRow) {
		const translatorId = translatorRow.id;
		const roleFilter = or(
			eq(table.gameTranslation.translatorId, translatorId),
			eq(table.gameTranslation.proofreaderId, translatorId)
		);

		const [statusRows, translationRows] = await Promise.all([
			db
				.select({
					status: table.gameTranslation.status,
					total: count()
				})
				.from(table.gameTranslation)
				.where(roleFilter)
				.groupBy(table.gameTranslation.status),
			db
				.select({
					status: table.gameTranslation.status,
					version: table.gameTranslation.version,
					tversion: table.gameTranslation.tversion,
					tname: table.gameTranslation.tname,
					translatorId: table.gameTranslation.translatorId,
					translatorAlertsEnabled: table.gameTranslation.translatorAlertsEnabled,
					proofreaderId: table.gameTranslation.proofreaderId,
					gameVersion: table.game.gameVersion
				})
				.from(table.gameTranslation)
				.innerJoin(table.game, eq(table.game.id, table.gameTranslation.gameId))
				.where(roleFilter)
		]);

		const byStatus = { inProgress: 0, completed: 0, abandoned: 0 };
		let total = 0;
		for (const row of statusRows) {
			const n = Number(row.total ?? 0);
			total += n;
			if (row.status === 'completed') byStatus.completed += n;
			else if (row.status === 'abandoned') byStatus.abandoned += n;
			else byStatus.inProgress += n;
		}

		let asTranslator = 0;
		let asProofreader = 0;
		let upToDate = 0;
		let outdated = 0;

		for (const row of translationRows) {
			if (row.translatorId === translatorId) asTranslator += 1;
			if (row.proofreaderId === translatorId) asProofreader += 1;
			if (
				isTranslationOutdatedForLinkedTranslator(
					{
						status: row.status,
						version: row.version,
						tversion: row.tversion,
						tname: row.tname,
						translatorId: row.translatorId,
						translatorAlertsEnabled: row.translatorAlertsEnabled,
						proofreaderId: row.proofreaderId
					},
					row.gameVersion,
					translatorId
				)
			) {
				outdated += 1;
			} else {
				upToDate += 1;
			}
		}

		translations = {
			total,
			asTranslator,
			asProofreader,
			inProgress: byStatus.inProgress,
			completed: byStatus.completed,
			abandoned: byStatus.abandoned,
			upToDate,
			outdated
		};
	}

	return {
		direct: {
			gamesAdded: Number(userRow?.gameAdd ?? 0),
			gamesEdited: Number(userRow?.gameEdit ?? 0)
		},
		submissions,
		translations
	};
}
