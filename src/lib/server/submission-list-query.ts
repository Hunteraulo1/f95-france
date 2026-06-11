import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { hasSubmissionOpenedByUserIdColumn } from '$lib/server/submission-opened-by-compat';
import { submissionOpenedByUser } from '$lib/server/submission-users';
import type { SQL } from 'drizzle-orm';
import { desc, eq } from 'drizzle-orm';

export type SubmissionListRow = {
	id: string;
	status: string;
	type: string;
	adminNotes: string | null;
	data: string;
	gameId: string | null;
	translationId: string | null;
	createdAt: Date;
	updatedAt: Date;
	user: { id: string; username: string; avatar: string | null; role: string } | null;
	openedByUser: { id: string; username: string; avatar: string | null; role: string } | null;
	game: {
		id: string;
		name: string;
		image: string;
		website: string;
	} | null;
	translation: {
		id: string;
		version: string | null;
		tversion: string | null;
		translationName: string | null;
	} | null;
};

export async function fetchSubmissionListRows(options: {
	where?: SQL;
	limit: number;
	offset: number;
}): Promise<SubmissionListRow[]> {
	const hasOpenedBy = await hasSubmissionOpenedByUserIdColumn();
	const { limit, offset, where } = options;

	if (hasOpenedBy) {
		const chain = db
			.select({
				id: table.submission.id,
				status: table.submission.status,
				type: table.submission.type,
				adminNotes: table.submission.adminNotes,
				data: table.submission.data,
				gameId: table.submission.gameId,
				translationId: table.submission.translationId,
				createdAt: table.submission.createdAt,
				updatedAt: table.submission.updatedAt,
				user: {
					id: table.user.id,
					username: table.user.username,
					avatar: table.user.avatar,
					role: table.user.role
				},
				openedByUser: {
					id: submissionOpenedByUser.id,
					username: submissionOpenedByUser.username,
					avatar: submissionOpenedByUser.avatar,
					role: submissionOpenedByUser.role
				},
				game: {
					id: table.game.id,
					name: table.game.name,
					image: table.game.image,
					website: table.game.website
				},
				translation: {
					id: table.gameTranslation.id,
					version: table.gameTranslation.version,
					tversion: table.gameTranslation.tversion,
					translationName: table.gameTranslation.translationName
				}
			})
			.from(table.submission)
			.leftJoin(table.user, eq(table.submission.userId, table.user.id))
			.leftJoin(
				submissionOpenedByUser,
				eq(submissionOpenedByUser.id, table.submission.openedByUserId)
			)
			.leftJoin(table.game, eq(table.submission.gameId, table.game.id))
			.leftJoin(
				table.gameTranslation,
				eq(table.submission.translationId, table.gameTranslation.id)
			);

		return (where ? chain.where(where) : chain)
			.orderBy(desc(table.submission.createdAt))
			.limit(limit)
			.offset(offset);
	}

	const chain = db
		.select({
			id: table.submission.id,
			status: table.submission.status,
			type: table.submission.type,
			adminNotes: table.submission.adminNotes,
			data: table.submission.data,
			gameId: table.submission.gameId,
			translationId: table.submission.translationId,
			createdAt: table.submission.createdAt,
			updatedAt: table.submission.updatedAt,
			user: {
				id: table.user.id,
				username: table.user.username,
				avatar: table.user.avatar,
				role: table.user.role
			},
			game: {
				id: table.game.id,
				name: table.game.name,
				image: table.game.image,
				website: table.game.website
			},
			translation: {
				id: table.gameTranslation.id,
				version: table.gameTranslation.version,
				tversion: table.gameTranslation.tversion,
				translationName: table.gameTranslation.translationName
			}
		})
		.from(table.submission)
		.leftJoin(table.user, eq(table.submission.userId, table.user.id))
		.leftJoin(table.game, eq(table.submission.gameId, table.game.id))
		.leftJoin(table.gameTranslation, eq(table.submission.translationId, table.gameTranslation.id));

	const rows = await (where ? chain.where(where) : chain)
		.orderBy(desc(table.submission.createdAt))
		.limit(limit)
		.offset(offset);

	return rows.map((row) => ({ ...row, openedByUser: null }));
}
