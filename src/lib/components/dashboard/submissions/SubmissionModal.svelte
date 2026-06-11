<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { normalizeTranslatorPages } from '$lib/components/dashboard/submissions/submission-modal-field-utils';
	import type {
		SubmissionModalItem,
		SubmissionModalTranslator
	} from '$lib/components/dashboard/submissions/submission-modal-types';
	import SubmissionModalDetailsPanel from '$lib/components/dashboard/submissions/SubmissionModalDetailsPanel.svelte';
	import SubmissionModalGameEditFields from '$lib/components/dashboard/submissions/SubmissionModalGameEditFields.svelte';
	import SubmissionModalHeader from '$lib/components/dashboard/submissions/SubmissionModalHeader.svelte';
	import SubmissionModalStatusPanel from '$lib/components/dashboard/submissions/SubmissionModalStatusPanel.svelte';
	import SubmissionModalTranslationEditFields from '$lib/components/dashboard/submissions/SubmissionModalTranslationEditFields.svelte';
	import SubmissionModalTranslatorPagesEdit from '$lib/components/dashboard/submissions/SubmissionModalTranslatorPagesEdit.svelte';
	import { createFormEnhance } from '$lib/forms/enhance';
	import { hasPermission } from '$lib/permissions/client';
	import type { GameTranslation } from '$lib/server/db/schema';
	import {
		gameImageRequiredForWebsite,
		isIntegrated,
		isNoTranslation,
		normalizeGameImageForStorage,
		normalizeTranslationTversion,
		requiresTranslationVersion
	} from '$lib/utils/game-form-validation';
	import { validateSubmissionEditLinks } from '$lib/utils/link-validation';
	import { validateStatusChange } from '$lib/utils/submissions';

	interface Props {
		submission: SubmissionModalItem | null;
		translators: SubmissionModalTranslator[];
		canEditStatus?: boolean;
		onClose: () => void;
	}

	let { submission, translators, canEditStatus = false, onClose }: Props = $props();

	let statusError = $state<string | null>(null);
	let selectedStatus = $state<string>('pending');
	let adminNotesText = $state<string>('');
	let submissionEditError = $state<string | null>(null);
	let editGameName = $state<string>('');
	let editGameDescription = $state<string>('');
	let editGameWebsite = $state<string>('f95z');
	let editGameThreadId = $state<string>('');
	let editGameTags = $state<string>('');
	let editGameLink = $state<string>('');
	let editGameImage = $state<string>('');
	let editGameGameVersion = $state<string>('');
	let editGameAutoCheck = $state<boolean>(true);

	let editTranslationTranslationName = $state<string>('');
	let editTranslationVersion = $state<string>('');
	let editTranslationTname = $state<string>('translation');
	let editTranslationTversion = $state<string>('');
	let editTranslationStatus = $state<string>('in_progress');
	let editTranslationTtype = $state<string>('manual');
	let editTranslationGameType = $state<string>('other');
	let editTranslationTlink = $state<string>('');
	let editTranslationAc = $state<boolean>(false);
	let editTranslationTranslatorId = $state<string>('');
	let editTranslationProofreaderId = $state<string>('');
	let editTranslatorPages = $state<Array<{ name: string; link: string }>>([{ name: '', link: '' }]);

	const resolveTranslatorSelectValue = (value: unknown): string => {
		if (typeof value !== 'string' || !value) return '';
		const byId = translators.find((t) => t.id === value);
		if (byId) return byId.id;
		const byName = translators.find((t) => t.name === value);
		return byName?.id ?? '';
	};

	const getTranslator = (translatorId: unknown): SubmissionModalTranslator | null => {
		if (typeof translatorId !== 'string' || !translatorId) return null;
		return translators.find((t) => t.id === translatorId) || null;
	};

	const handleTranslatorClick = async (translatorId: unknown) => {
		const translator = getTranslator(translatorId);
		const profileRef = translator?.username ?? null;
		if (profileRef) {
			await goto(resolve(`/dashboard/profile/${profileRef}`));
		}
	};

	$effect(() => {
		if (submission) {
			selectedStatus = submission.status;
			adminNotesText = submission.adminNotes || '';
			statusError = null;
			submissionEditError = null;

			const game = submission.parsedData?.game;
			const tr = submission.parsedData?.translation as GameTranslation | undefined;

			editGameName = game?.name ?? '';
			editGameDescription = (game?.description ?? '') as string;
			editGameWebsite = (game?.website ?? 'f95z') as string;
			editGameThreadId = game?.threadId != null ? String(game.threadId) : '';
			editGameTags = (game?.tags ?? '') as string;
			editGameLink = (game?.link ?? '') as string;
			editGameImage = normalizeGameImageForStorage(
				(game?.website ?? 'f95z') as string,
				game?.image ?? '',
				{
					gameAutoCheck: typeof game?.gameAutoCheck === 'boolean' ? game.gameAutoCheck : undefined
				}
			);
			editGameGameVersion = (game?.gameVersion ?? '') as string;
			editGameAutoCheck = typeof game?.gameAutoCheck === 'boolean' ? game?.gameAutoCheck : true;

			const currentTr = submission.currentTranslation;
			const fallbackGameType =
				tr?.gameType ?? currentTr?.gameType ?? submission.parsedData?.game?.type ?? 'other';
			const fallbackTname = tr?.tname ?? currentTr?.tname ?? 'translation';
			const fallbackStatus = tr?.status ?? currentTr?.status ?? 'in_progress';
			const fallbackTtype = tr?.ttype ?? currentTr?.ttype ?? 'manual';
			const fallbackAc = typeof tr?.ac === 'boolean' ? tr.ac : (currentTr?.ac ?? false);
			const fallbackTranslatorId = tr?.translatorId ?? currentTr?.translatorId ?? '';
			const fallbackProofreaderId = tr?.proofreaderId ?? currentTr?.proofreaderId ?? '';

			editTranslationTranslationName = tr?.translationName ?? currentTr?.translationName ?? '';
			editTranslationVersion = (tr?.version ?? currentTr?.version ?? '') as string;
			editTranslationTname = fallbackTname as string;
			editTranslationTversion = (tr?.tversion ?? currentTr?.tversion ?? '') as string;
			editTranslationStatus = fallbackStatus as string;
			editTranslationTtype = fallbackTtype as string;
			editTranslationGameType = fallbackGameType as string;
			editTranslationTlink = (tr?.tlink ?? currentTr?.tlink ?? '') as string;
			editTranslationAc = fallbackAc;
			editTranslationTranslatorId = resolveTranslatorSelectValue(fallbackTranslatorId);
			editTranslationProofreaderId = resolveTranslatorSelectValue(fallbackProofreaderId);

			if (submission.type === 'translator_pages') {
				const pages = normalizeTranslatorPages(submission.parsedData?.pages);
				editTranslatorPages = pages.length ? pages : [{ name: '', link: '' }];
			}
		}
	});

	const isDeleteSubmission = $derived(submission?.type === 'delete');
	const translationVersionRequired = $derived(requiresTranslationVersion(editTranslationTname));
	const translationVersionLocked = $derived(
		isNoTranslation(editTranslationTname) || isIntegrated(editTranslationTname)
	);

	const onEditTranslationTnameChange = () => {
		if (isNoTranslation(editTranslationTname)) {
			editTranslationTversion = '';
			editTranslationTlink = '';
			editTranslationTtype = 'hs';
		} else if (isIntegrated(editTranslationTname)) {
			editTranslationTversion = 'Intégrée';
			editTranslationTlink = '';
		} else if (editTranslationTversion === 'Intégrée') {
			editTranslationTversion = '';
		}
	};

	const buildEditTranslationPayload = () => ({
		translationName: editTranslationTranslationName.trim() || null,
		version: editTranslationVersion.trim() || null,
		tversion: normalizeTranslationTversion(editTranslationTname, editTranslationTversion),
		status: editTranslationStatus,
		ttype: editTranslationTtype,
		gameType: editTranslationGameType,
		tlink: editTranslationTlink.trim() || null,
		tname: editTranslationTname,
		translatorId: editTranslationTranslatorId || null,
		proofreaderId: editTranslationProofreaderId || null,
		ac: editTranslationAc
	});

	const submissionDataJsonHidden = $derived(() => {
		if (!submission) return '';

		if (submission.type === 'delete') {
			return '';
		}

		if (submission.type === 'translator_pages') {
			return JSON.stringify({
				translatorId:
					submission.parsedData?.translatorId ?? submission.currentTranslator?.id ?? null,
				pages: normalizeTranslatorPages(editTranslatorPages)
			});
		}

		if (submission.type === 'translation') {
			return JSON.stringify({
				gameId: submission.gameId ?? submission.parsedData?.gameId ?? null,
				translationId: submission.translationId ?? submission.parsedData?.translationId ?? null,
				translation: buildEditTranslationPayload()
			});
		}

		const gameObj: Record<string, unknown> = {
			name: editGameName,
			description: editGameDescription.trim() || null,
			website: editGameWebsite,
			threadId: editGameThreadId.trim() || null,
			tags: editGameTags.trim() || null,
			link: editGameLink.trim() || null,
			image: normalizeGameImageForStorage(editGameWebsite, editGameImage, {
				gameAutoCheck: editGameAutoCheck
			}),
			gameAutoCheck: editGameAutoCheck,
			gameVersion: editGameGameVersion.trim() || null
		};
		const includeTranslation = Boolean(submission.parsedData?.translation);
		const out: Record<string, unknown> = { game: gameObj };

		if (includeTranslation) {
			out.translation = buildEditTranslationPayload();
		}

		return JSON.stringify(out);
	});

	const requireGameImage = $derived(
		gameImageRequiredForWebsite(editGameWebsite, { gameAutoCheck: editGameAutoCheck })
	);

	const isStatusRequiringAdminNote = $derived(
		selectedStatus === 'rejected' || selectedStatus === 'to_fix'
	);
	const hasNotesError = $derived(
		isStatusRequiringAdminNote && (!adminNotesText || adminNotesText.trim() === '')
	);
	const canReviewSubmissions = $derived($hasPermission('submissions.review'));
	const canModerateSubmission = $derived(canEditStatus || canReviewSubmissions);
	const statusFormAction = $derived(
		canEditStatus ? '?/updateStatus' : `${resolve('/dashboard/submits')}?/updateStatus`
	);
	const submissionDataFormAction = $derived(
		canModerateSubmission && !canEditStatus
			? `${resolve('/dashboard/submits')}?/updateSubmissionData`
			: '?/updateSubmissionData'
	);
	const canCancelSubmission = $derived(
		Boolean(!canModerateSubmission && submission?.status === 'pending')
	);
	const canEditSubmissionDataAsUser = $derived(
		Boolean(
			!canEditStatus &&
			submission?.type !== 'translator_pages' &&
			submission?.type !== 'delete' &&
			(submission?.status === 'pending' ||
				submission?.status === 'opened' ||
				submission?.status === 'to_fix' ||
				submission?.status === 'rejected')
		)
	);
	const canEditSubmissionDataAsAdmin = $derived(
		Boolean(
			canModerateSubmission &&
			!isDeleteSubmission &&
			(submission?.status === 'pending' || submission?.status === 'opened')
		)
	);
	const canEditSubmissionDataAllowed = $derived(
		canEditSubmissionDataAsUser || canEditSubmissionDataAsAdmin
	);
	const canAdminManageStatusOnly = $derived(Boolean(canModerateSubmission && isDeleteSubmission));
	const showAdminSubmissionForm = $derived(
		canEditSubmissionDataAllowed || canAdminManageStatusOnly
	);
	const isOpenedReadOnlyForUser = $derived(
		Boolean(!canModerateSubmission && submission?.status === 'opened')
	);
	const adminNoteDisplay = $derived(submission?.adminNotes?.trim() ?? '');
</script>

{#if submission}
	<div class="modal-open modal">
		<div class="modal-box flex max-h-[90vh] max-w-7xl flex-col">
			<SubmissionModalHeader {submission} />

			{#if adminNoteDisplay}
				<div role="status" class="mb-4 alert items-start alert-info">
					<div class="space-y-1">
						<div class="font-semibold">Note admin</div>
						<p class="wrap-break-word whitespace-pre-wrap">{adminNoteDisplay}</p>
					</div>
				</div>
			{/if}

			<div class="md flex flex-col gap-2 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
				<SubmissionModalDetailsPanel
					{submission}
					{translators}
					onTranslatorClick={handleTranslatorClick}
				/>
				<div class="h-full md:pl-2">
					{#if showAdminSubmissionForm}
						<div>
							{#if submissionEditError}
								<div class="mb-4 alert alert-error">
									<span>{submissionEditError}</span>
								</div>
							{/if}
							{#if isOpenedReadOnlyForUser}
								<div class="mb-4 alert alert-warning">
									<span>
										Cette soumission n’est plus modifiable : un listeur est actuellement en train de
										la traiter.
									</span>
								</div>
							{/if}
							{#if canAdminManageStatusOnly}
								<div class="mb-4 alert alert-info">
									<span
										>Les données de suppression ne sont pas modifiables — validez ou refusez la
										demande.</span
									>
								</div>
							{/if}
							<form
								id="submission-save-form"
								method="POST"
								action={canModerateSubmission ? statusFormAction : submissionDataFormAction}
								use:enhance={createFormEnhance({
									updateOnlyOnSuccess: true,
									invalidateAll: true,
									onStart: () => {
										submissionEditError = null;
										statusError = null;
									},
									validate: ({ cancel }) => {
										if (canModerateSubmission) {
											const validationError = validateStatusChange(selectedStatus, adminNotesText);
											if (validationError) {
												statusError = validationError;
												cancel();
												return;
											}
										}
										if (canEditSubmissionDataAllowed && submission) {
											const linkError = validateSubmissionEditLinks({
												submissionType: submission.type,
												gameLink: editGameLink,
												gameImage: editGameImage,
												gameWebsite: editGameWebsite,
												translationTlink: editTranslationTlink,
												translationTname: editTranslationTname,
												includeTranslation: Boolean(submission.parsedData?.translation),
												translatorPages: editTranslatorPages,
												requireGameImage: requireGameImage
											});
											if (linkError) {
												submissionEditError = linkError;
												cancel();
											}
										}
									},
									onSuccess: () => {
										onClose();
									},
									onFailure: (message) => {
										if (canModerateSubmission) {
											statusError = message;
										} else {
											submissionEditError = message;
										}
									}
								})}
							>
								<input type="hidden" name="submissionId" value={submission.id} />
								{#if canEditSubmissionDataAllowed}
									<input type="hidden" name="submissionDataJson" value={submissionDataJsonHidden} />
								{/if}
								{#if canModerateSubmission}
									<input type="hidden" name="status" value={selectedStatus} />
									<input type="hidden" name="adminNotes" value={adminNotesText} />
								{/if}
								{#if submission.type === 'translator_pages'}
									<input
										type="hidden"
										name="translatorId"
										value={submission.parsedData?.translatorId ??
											submission.currentTranslator?.id ??
											''}
									/>
								{/if}
								<fieldset disabled={isOpenedReadOnlyForUser}>
									{#if submission.type === 'translator_pages'}
										<SubmissionModalTranslatorPagesEdit bind:pages={editTranslatorPages} />
									{:else if submission.type !== 'translation' && submission.type !== 'translator_pages' && submission.type !== 'delete'}
										<SubmissionModalGameEditFields
											bind:editGameName
											bind:editGameDescription
											bind:editGameWebsite
											bind:editGameThreadId
											bind:editGameTags
											bind:editGameLink
											bind:editGameImage
											bind:editGameGameVersion
											{requireGameImage}
										/>
									{/if}
									{#if submission.type === 'translation' || submission.parsedData?.translation}
										<SubmissionModalTranslationEditFields
											bind:editTranslationTranslationName
											bind:editTranslationVersion
											bind:editTranslationTname
											bind:editTranslationTversion
											bind:editTranslationStatus
											bind:editTranslationTtype
											bind:editTranslationGameType
											bind:editTranslationTlink
											bind:editTranslationAc
											bind:editTranslationTranslatorId
											bind:editTranslationProofreaderId
											{translators}
											{translationVersionRequired}
											{translationVersionLocked}
											{onEditTranslationTnameChange}
										/>
									{/if}
								</fieldset>
								{#if !canModerateSubmission && submission?.status !== 'opened'}
									<div class="modal-action mt-4">
										<button type="button" class="btn" onclick={onClose}>Annuler</button>
										<button type="submit" class="btn btn-primary">Enregistrer</button>
									</div>
								{/if}
							</form>
						</div>
					{/if}
					{#if canCancelSubmission}
						<div class="mt-4 border-t border-base-300 pt-4">
							<form
								method="POST"
								action="?/cancelSubmission"
								use:enhance={createFormEnhance({
									invalidateAll: true,
									onStart: () => {
										submissionEditError = null;
									},
									onSuccess: () => {
										onClose();
									},
									onFailure: (message) => {
										submissionEditError = message;
									}
								})}
							>
								<input type="hidden" name="submissionId" value={submission.id} />
								<div class="modal-action mt-0">
									<button type="submit" class="btn btn-outline btn-error"
										>Annuler la soumission</button
									>
								</div>
							</form>
						</div>
					{/if}

					<SubmissionModalStatusPanel
						bind:selectedStatus
						bind:adminNotesText
						{statusError}
						{hasNotesError}
						{isStatusRequiringAdminNote}
						{canModerateSubmission}
						{onClose}
					/>
				</div>
			</div>
		</div>
		<button type="button" class="modal-backdrop" onclick={onClose} aria-label="Fermer la modal"
		></button>
	</div>
{/if}
