import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { defaultGameTypeForGame } from '$lib/server/game-engine-type';
import { fetchSubmissionListRows } from '$lib/server/submission-list-query';
import {
  parseSubmissionPayloadJson,
  persistSubmissionPayload,
  validateSubmissionPayloadForType
} from '$lib/server/submission-payload-update';
import { fail } from '@sveltejs/kit';
import { and, eq, sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

const PAGE_SIZE = 20;

const normalizeMaybeString = (value: FormDataEntryValue | null): string | null => {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
};

const formDataToSubmissionPayload = (
	submissionType: string,
	formData: FormData
): Record<string, unknown> | null => {
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
		return {
			translation: {
				translationName: normalizeMaybeString(formData.get('editTranslationTranslationName')),
				version: normalizeMaybeString(formData.get('editTranslationVersion')),
				tversion: normalizeMaybeString(formData.get('editTranslationTversion')) ?? '',
				status: normalizeMaybeString(formData.get('editTranslationStatus')) ?? 'in_progress',
				ttype: normalizeMaybeString(formData.get('editTranslationTtype')) ?? 'manual',
				gameType: normalizeMaybeString(formData.get('editTranslationGameType')) ?? 'other',
				tlink: normalizeMaybeString(formData.get('editTranslationTlink')),
				tname: normalizeMaybeString(formData.get('editTranslationTname')) ?? 'translation',
				translatorId: normalizeMaybeString(formData.get('editTranslationTranslatorId')),
				proofreaderId: normalizeMaybeString(formData.get('editTranslationProofreaderId')),
				ac: formData.get('editTranslationAc') !== null
			}
		};
	}

	return {
		game: {
			name: normalizeMaybeString(formData.get('editGameName')) ?? '',
			description: normalizeMaybeString(formData.get('editGameDescription')),
			website: normalizeMaybeString(formData.get('editGameWebsite')) ?? 'f95z',
			threadId: normalizeMaybeString(formData.get('editGameThreadId')),
			tags: normalizeMaybeString(formData.get('editGameTags')),
			link: normalizeMaybeString(formData.get('editGameLink')),
			image: normalizeMaybeString(formData.get('editGameImage')) ?? '',
			gameAutoCheck: formData.get('editGameAutoCheck') !== null,
			gameVersion: normalizeMaybeString(formData.get('editGameGameVersion'))
		},
		...(formData.get('editTranslationStatus')
			? {
					translation: {
						translationName: normalizeMaybeString(formData.get('editTranslationTranslationName')),
						version: normalizeMaybeString(formData.get('editTranslationVersion')),
						tversion: normalizeMaybeString(formData.get('editTranslationTversion')) ?? '',
						status: normalizeMaybeString(formData.get('editTranslationStatus')) ?? 'in_progress',
						ttype: normalizeMaybeString(formData.get('editTranslationTtype')) ?? 'manual',
						gameType: normalizeMaybeString(formData.get('editTranslationGameType')) ?? 'other',
						tlink: normalizeMaybeString(formData.get('editTranslationTlink')),
						tname: normalizeMaybeString(formData.get('editTranslationTname')) ?? 'translation',
						translatorId: normalizeMaybeString(formData.get('editTranslationTranslatorId')),
						proofreaderId: normalizeMaybeString(formData.get('editTranslationProofreaderId')),
						ac: formData.get('editTranslationAc') !== null
					}
				}
			: {})
	};
};

export const load: PageServerLoad = async ({ locals, url }) => {
	// Vérifier que l'utilisateur est authentifié
	if (!locals.user) {
		throw new Error('Non authentifié');
	}

	const statusFilterRaw = url.searchParams.get('status') || 'pending';
	const statusFilter =
		statusFilterRaw === 'all' ||
		statusFilterRaw === 'pending' ||
		statusFilterRaw === 'opened' ||
		statusFilterRaw === 'to_fix' ||
		statusFilterRaw === 'accepted' ||
		statusFilterRaw === 'rejected'
			? statusFilterRaw
			: 'pending';

	const pageRaw = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
	const requestedPage = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

	try {
		const whereCondition =
			statusFilter === 'all'
				? eq(table.submission.userId, locals.user.id)
				: and(
						eq(table.submission.userId, locals.user.id),
						eq(table.submission.status, statusFilter)
					);

		const [countRow] = await db
			.select({ count: sql<number>`count(*)`.as('count') })
			.from(table.submission)
			.where(whereCondition);

		const totalCount = Number(countRow?.count ?? 0);
		const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
		const page = Math.min(requestedPage, totalPages);
		const offset = (page - 1) * PAGE_SIZE;

		const submissions = await fetchSubmissionListRows({
			where: whereCondition,
			limit: PAGE_SIZE,
			offset
		});

		// Parser les données et récupérer les jeux/traductions actuels pour les modifications
		const submissionsWithData = await Promise.all(
			submissions.map(async (sub) => {
				let parsedData = null;
				let currentGame = null;
				let currentTranslation = null;
				let currentTranslator = null;

				if (sub.data) {
					try {
						parsedData = JSON.parse(sub.data);
					} catch (e) {
						console.error('Erreur lors du parsing des données de soumission:', e);
					}
				}

				// Pour les soumissions acceptées, charger les données actuelles depuis la base de données
				// Pour les modifications de jeu, récupérer le jeu actuel
				if (sub.gameId) {
					const currentGameResult = await db
						.select()
						.from(table.game)
						.where(eq(table.game.id, sub.gameId))
						.limit(1);

					if (currentGameResult.length > 0) {
						const row = currentGameResult[0];
						const repType = await defaultGameTypeForGame(row.id);
						currentGame = { ...row, type: repType };
					}
				}

				// Pour les modifications de traduction, récupérer la traduction actuelle
				if (sub.translationId) {
					const currentTranslationResult = await db
						.select()
						.from(table.gameTranslation)
						.where(eq(table.gameTranslation.id, sub.translationId))
						.limit(1);

					if (currentTranslationResult.length > 0) {
						currentTranslation = currentTranslationResult[0];
					}
				}

				// Pour les pages traducteur, récupérer le traducteur actuel
				if (sub.type === 'translator_pages' && parsedData?.translatorId) {
					const currentTranslatorResult = await db
						.select({
							id: table.translator.id,
							name: table.translator.name,
							pages: table.translator.pages
						})
						.from(table.translator)
						.where(eq(table.translator.id, String(parsedData.translatorId)))
						.limit(1);

					if (currentTranslatorResult.length > 0) {
						const row = currentTranslatorResult[0];
						let pages: Array<{ name: string; link: string }> = [];
						try {
							const parsed = JSON.parse(row.pages || '[]') as Array<{
								name?: string;
								link?: string;
							}>;
							if (Array.isArray(parsed)) {
								pages = parsed.map((p) => ({
									name: String(p.name ?? ''),
									link: String(p.link ?? '')
								}));
							}
						} catch {
							pages = [];
						}

						currentTranslator = {
							id: row.id,
							name: row.name,
							pages
						};
					}
				}

				return {
					...sub,
					parsedData,
					currentGame,
					currentTranslation,
					currentTranslator
				};
			})
		);

		// Compter les soumissions par statut pour l'utilisateur
		const pendingCountResult = await db
			.select({ count: sql<number>`count(*)`.as('count') })
			.from(table.submission)
			.where(
				and(eq(table.submission.userId, locals.user.id), eq(table.submission.status, 'pending'))
			);

		const openedCountResult = await db
			.select({ count: sql<number>`count(*)`.as('count') })
			.from(table.submission)
			.where(
				and(eq(table.submission.userId, locals.user.id), eq(table.submission.status, 'opened'))
			);

		const acceptedCountResult = await db
			.select({ count: sql<number>`count(*)`.as('count') })
			.from(table.submission)
			.where(
				and(eq(table.submission.userId, locals.user.id), eq(table.submission.status, 'accepted'))
			);

		const rejectedCountResult = await db
			.select({ count: sql<number>`count(*)`.as('count') })
			.from(table.submission)
			.where(
				and(eq(table.submission.userId, locals.user.id), eq(table.submission.status, 'rejected'))
			);

		const toFixCountResult = await db
			.select({ count: sql<number>`count(*)`.as('count') })
			.from(table.submission)
			.where(
				and(eq(table.submission.userId, locals.user.id), eq(table.submission.status, 'to_fix'))
			);

		const pendingCount = pendingCountResult[0]?.count || 0;
		const openedCount = openedCountResult[0]?.count || 0;
		const toFixCount = toFixCountResult[0]?.count || 0;
		const acceptedCount = acceptedCountResult[0]?.count || 0;
		const rejectedCount = rejectedCountResult[0]?.count || 0;

		// Charger tous les traducteurs pour pouvoir afficher leurs noms
		const translators = await db
			.select({
				id: table.translator.id,
				name: table.translator.name,
				userId: table.translator.userId,
				username: table.user.username
			})
			.from(table.translator)
			.leftJoin(table.user, eq(table.user.id, table.translator.userId));

		return {
			submissions: submissionsWithData,
			statusFilter,
			page,
			pageSize: PAGE_SIZE,
			totalCount,
			totalPages,
			pendingCount,
			openedCount,
			toFixCount,
			acceptedCount,
			rejectedCount,
			translators
		};
	} catch (error: unknown) {
		console.warn(
			'Erreur chargement soumissions — vérifier migrations (`opened_by_user_id`) :',
			error
		);
		return {
			submissions: [],
			statusFilter,
			page: 1,
			pageSize: PAGE_SIZE,
			totalCount: 0,
			totalPages: 1,
			pendingCount: 0,
			openedCount: 0,
			toFixCount: 0,
			acceptedCount: 0,
			rejectedCount: 0,
			translators: []
		};
	}
};

export const actions: Actions = {
	cancelSubmission: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Non authentifié' });

		const formData = await request.formData();
		const submissionId = formData.get('submissionId');
		if (typeof submissionId !== 'string' || !submissionId.trim()) {
			return fail(400, { message: 'ID de soumission requis' });
		}

		const [sub] = await db
			.select({
				id: table.submission.id,
				userId: table.submission.userId,
				status: table.submission.status
			})
			.from(table.submission)
			.where(eq(table.submission.id, submissionId))
			.limit(1);

		if (!sub) return fail(404, { message: 'Soumission non trouvée' });
		if (sub.userId !== locals.user.id) return fail(403, { message: 'Accès non autorisé' });
		if (sub.status !== 'pending') {
			return fail(400, { message: 'Seules les soumissions en attente peuvent être annulées' });
		}

		await db
			.update(table.submission)
			.set({
				status: 'rejected',
				adminNotes: 'Annulée par l’utilisateur',
				updatedAt: new Date()
			})
			.where(eq(table.submission.id, submissionId));

		return { success: true };
	},
	updateSubmissionData: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Non authentifié' });

		const formData = await request.formData();
		const submissionId = formData.get('submissionId');
		const submissionDataJson = formData.get('submissionDataJson');

		if (typeof submissionId !== 'string' || !submissionId.trim()) {
			return fail(400, { message: 'ID de soumission requis' });
		}

		const [sub] = await db
			.select({
				id: table.submission.id,
				status: table.submission.status,
				adminNotes: table.submission.adminNotes,
				userId: table.submission.userId,
				type: table.submission.type
			})
			.from(table.submission)
			.where(eq(table.submission.id, submissionId))
			.limit(1);

		if (!sub) return fail(404, { message: 'Soumission non trouvée' });
		if (sub.userId !== locals.user.id) return fail(403, { message: 'Accès non autorisé' });
		if (sub.type === 'delete') {
			return fail(403, {
				message: 'Les soumissions de suppression ne peuvent pas être corrigées puis renvoyées'
			});
		}

		// Autoriser la correction tant que la soumission n'est pas finalisée :
		// l'utilisateur peut modifier si elle est "pending", "opened", "to_fix" ou "rejected".
		if (
			sub.status !== 'pending' &&
			sub.status !== 'opened' &&
			sub.status !== 'to_fix' &&
			sub.status !== 'rejected'
		) {
			return fail(403, {
				message: 'Seules les soumissions en attente, ouvertes ou refusées sont modifiables'
			});
		}

		let parsed = parseSubmissionPayloadJson(submissionDataJson);
		if (!parsed.ok) {
			const rebuiltPayload = formDataToSubmissionPayload(sub.type, formData);
			if (!rebuiltPayload) {
				return fail(400, { message: parsed.message });
			}
			parsed = { ok: true, data: rebuiltPayload };
		}

		const shapeError = validateSubmissionPayloadForType(sub.type, parsed.data);
		if (shapeError) return fail(400, { message: shapeError });

		await persistSubmissionPayload(submissionId, parsed.data);

		// Après correction d'une soumission marquée "à corriger" ou refusée, la remettre en attente.
		if (sub.status === 'rejected' || sub.status === 'to_fix') {
			await db
				.update(table.submission)
				.set({
					status: 'pending',
					adminNotes: null,
					updatedAt: new Date()
				})
				.where(eq(table.submission.id, submissionId));
		}

		return { success: true };
	}
};
