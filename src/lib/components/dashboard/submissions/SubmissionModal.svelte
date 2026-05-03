<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Game, GameTranslation } from '$lib/server/db/schema';

	/** Jeu tel qu’il apparaît dans le JSON des soumissions (champ moteur `type`). */
	type GameSubmissionJson = Game & { type?: string };
	import { user } from '$lib/stores';
	import {
		getStatusBadge,
		getTypeBadge,
		getTypeLabel,
		validateStatusChange
	} from '$lib/utils/submissions';

	interface FieldConfig<
		T extends GameTranslation | GameSubmissionJson = GameTranslation | GameSubmissionJson
	> {
		key: keyof T;
		label: string;
		options?: {
			isMultiline?: boolean;
			isUrl?: boolean;
			showIfEmpty?: boolean;
		};
	}

	interface Submission {
		id: string;
		status: string;
		type: string;
		translationId?: string | null;
		adminNotes?: string | null;
		parsedData?: {
			game?: GameSubmissionJson;
			translation?: GameTranslation;
		} | null;
		currentGame?: GameSubmissionJson | null;
		currentTranslation?: GameTranslation | null;
	}

	interface Translator {
		id: string;
		name: string;
		userId?: string | null;
	}

	interface Props {
		submission: Submission | null;
		translators: Translator[];
		canEditStatus?: boolean;
		onClose: () => void;
	}

	let { submission, translators, canEditStatus = false, onClose }: Props = $props();

	let statusError = $state<string | null>(null);
	let selectedStatus = $state<string>('pending');
	let adminNotesText = $state<string>('');
	let submissionEditError = $state<string | null>(null);
	// Champs "réels" pour modifier la soumission (au lieu d'un JSON visible)
	let editGameName = $state<string>('');
	let editGameDescription = $state<string>('');
	let editGameType = $state<string>('other');
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

	$effect(() => {
		if (submission) {
			selectedStatus = submission.status;
			adminNotesText = submission.adminNotes || '';
			statusError = null;
			submissionEditError = null;

			// Pré-remplir les champs éditables depuis parsedData (soumissions "pending").
			const game = submission.parsedData?.game;
			const tr = submission.parsedData?.translation as GameTranslation | undefined;

			editGameName = game?.name ?? '';
			editGameDescription = (game?.description ?? '') as string;
			editGameType = (game?.type ?? 'other') as string;
			editGameWebsite = (game?.website ?? 'f95z') as string;
			editGameThreadId = game?.threadId != null ? String(game.threadId) : '';
			editGameTags = (game?.tags ?? '') as string;
			editGameLink = (game?.link ?? '') as string;
			editGameImage = (game?.image ?? '') as string;
			editGameGameVersion = (game?.gameVersion ?? '') as string;
			editGameAutoCheck = typeof game?.gameAutoCheck === 'boolean' ? game?.gameAutoCheck : true;

			editTranslationTranslationName = tr?.translationName ?? '';
			editTranslationVersion = (tr?.version ?? '') as string;
			editTranslationTname = (tr?.tname ?? 'translation') as string;
			editTranslationTversion = (tr?.tversion ?? '') as string;
			editTranslationStatus = (tr?.status ?? 'in_progress') as string;
			editTranslationTtype = (tr?.ttype ?? 'manual') as string;
			editTranslationGameType = (tr?.gameType ?? 'other') as string;
			editTranslationTlink = (tr?.tlink ?? '') as string;
			editTranslationAc = typeof tr?.ac === 'boolean' ? tr?.ac : false;
			editTranslationTranslatorId = resolveTranslatorSelectValue(tr?.translatorId);
			editTranslationProofreaderId = resolveTranslatorSelectValue(tr?.proofreaderId);
		}
	});

	const submissionDataJsonHidden = $derived(() => {
		if (!submission) return '';

		if (submission.type === 'translation') {
			return JSON.stringify({
				translation: {
					translationName: editTranslationTranslationName.trim() || null,
					version: editTranslationVersion.trim() || null,
					tversion: editTranslationTversion,
					status: editTranslationStatus,
					ttype: editTranslationTtype,
					gameType: editTranslationGameType,
					tlink: editTranslationTlink.trim() || null,
					tname: editTranslationTname,
					translatorId: editTranslationTranslatorId || null,
					proofreaderId: editTranslationProofreaderId || null,
					ac: editTranslationAc
				}
			});
		}

		// game | update
		const gameObj = {
			name: editGameName,
			description: editGameDescription.trim() || null,
			type: editGameType,
			website: editGameWebsite,
			threadId: editGameThreadId.trim() || null,
			tags: editGameTags.trim() || null,
			link: editGameLink.trim() || null,
			image: editGameImage.trim(),
			gameAutoCheck: editGameAutoCheck,
			gameVersion: editGameGameVersion.trim() || null
		};

		const includeTranslation = Boolean(submission.parsedData?.translation);
		const out: Record<string, unknown> = { game: gameObj };

		if (includeTranslation) {
			out.translation = {
				translationName: editTranslationTranslationName.trim() || null,
				version: editTranslationVersion.trim() || null,
				tversion: editTranslationTversion,
				status: editTranslationStatus,
				ttype: editTranslationTtype,
				gameType: editTranslationGameType,
				tlink: editTranslationTlink.trim() || null,
				tname: editTranslationTname,
				translatorId: editTranslationTranslatorId || null,
				proofreaderId: editTranslationProofreaderId || null,
				ac: editTranslationAc
			};
		}

		return JSON.stringify(out);
	});

	const isRejected = $derived(selectedStatus === 'rejected');
	const hasNotesError = $derived(isRejected && (!adminNotesText || adminNotesText.trim() === ''));
	const canCancelSubmission = $derived(Boolean(!canEditStatus && submission?.status === 'pending'));
	/** Utilisateur : uniquement en attente, tant que l’admin n’a pas laissé de note (ancienne règle). */
	const canEditSubmissionDataAsUser = $derived(
		Boolean(
			!canEditStatus &&
			submission?.status === 'pending' &&
			(!submission?.adminNotes || submission.adminNotes.trim().length === 0)
		)
	);
	/** Admin : en attente ou ouverte, avant acceptation / refus. */
	const canEditSubmissionDataAsAdmin = $derived(
		Boolean(canEditStatus && (submission?.status === 'pending' || submission?.status === 'opened'))
	);
	const canEditSubmissionDataAllowed = $derived(
		canEditSubmissionDataAsUser || canEditSubmissionDataAsAdmin
	);

	const gameFields: FieldConfig<GameSubmissionJson>[] = [
		{ key: 'name', label: 'Nom' },
		{ key: 'description', label: 'Description', options: { isMultiline: true, showIfEmpty: true } },
		{ key: 'type', label: 'Moteur (toutes les lignes si renseigné)' },
		{ key: 'website', label: 'Site web' },
		{ key: 'threadId', label: 'Thread ID', options: { showIfEmpty: true } },
		{ key: 'tags', label: 'Tags', options: { isMultiline: true, showIfEmpty: true } },
		{ key: 'link', label: 'Lien', options: { isUrl: true, showIfEmpty: true } },
		{ key: 'image', label: 'Image', options: { isUrl: true } },
		{ key: 'gameVersion', label: 'Version jeu (fiche)', options: { showIfEmpty: true } }
	];

	const translationFields: FieldConfig<GameTranslation>[] = [
		{ key: 'translationName', label: 'Nom de traduction' },
		{ key: 'tname', label: 'Status de la traduction', options: { showIfEmpty: true } },
		{ key: 'tversion', label: 'Version traduction' },
		{ key: 'version', label: 'Version de référence', options: { showIfEmpty: true } },
		{ key: 'status', label: 'Statut' },
		{ key: 'gameType', label: 'Moteur (ligne)' },
		{ key: 'ttype', label: 'Type de traduction' },
		{ key: 'tlink', label: 'Lien', options: { isUrl: true } },
		{ key: 'ac', label: 'Auto-Check' },
		{ key: 'translatorId', label: 'Traducteur', options: { showIfEmpty: true } },
		{ key: 'proofreaderId', label: 'Relecteur', options: { showIfEmpty: true } }
	];

	const getFieldValue = (
		obj: Record<string, unknown>,
		key: string
	): string | number | boolean | null | undefined => {
		return obj[key] as string | number | boolean | null | undefined;
	};

	const valuesAreEqual = (
		oldValue: string | number | boolean | null | undefined,
		newValue: string | number | boolean | null | undefined
	): boolean => {
		const normalizedOld = oldValue === null || oldValue === undefined ? null : oldValue;
		const normalizedNew = newValue === null || newValue === undefined ? null : newValue;

		if (normalizedOld === null && normalizedNew === null) {
			return true;
		}

		if (normalizedOld === null || normalizedNew === null) {
			return false;
		}

		return String(normalizedOld) === String(normalizedNew);
	};

	const getTranslatorName = (translatorId: unknown): string | null => {
		if (typeof translatorId !== 'string' || !translatorId) return null;
		const translator = translators.find((t) => t.id === translatorId);
		return translator?.name || null;
	};

	const getTranslator = (translatorId: unknown): Translator | null => {
		if (typeof translatorId !== 'string' || !translatorId) return null;
		return translators.find((t) => t.id === translatorId) || null;
	};

	const resolveTranslatorSelectValue = (value: unknown): string => {
		if (typeof value !== 'string' || !value) return '';
		const byId = translators.find((t) => t.id === value);
		if (byId) return byId.id;
		const byName = translators.find((t) => t.name === value);
		return byName?.id ?? '';
	};

	const handleTranslatorClick = async (translatorId: unknown) => {
		const translator = getTranslator(translatorId);
		if (translator?.userId) {
			await goto(resolve(`/dashboard/profile/${translator.userId}`));
		}
	};

	const formatFieldValue = (
		value: string | number | boolean | null | undefined,
		showIfEmpty: boolean,
		key?: string
	): string => {
		const isEmpty = value === null || value === undefined || value === '';
		if (isEmpty) {
			return showIfEmpty ? '(vide)' : '';
		}

		if (key === 'translatorId' || key === 'proofreaderId') {
			const translatorName = getTranslatorName(value);
			return translatorName || String(value);
		}

		if (key === 'gameType' && typeof value === 'string') {
			const labels: Record<string, string> = {
				renpy: "Ren'Py",
				rpgm: 'RPGM',
				unity: 'Unity',
				unreal: 'Unreal',
				flash: 'Flash',
				html: 'HTML',
				qsp: 'QSP',
				other: 'Autre'
			};
			return labels[value] ?? value;
		}

		if (typeof value === 'boolean') {
			return value ? 'Oui' : 'Non';
		}

		return String(value);
	};
</script>

{#if submission}
	<div class="modal-open modal">
		<div class="modal-box flex max-h-[90vh] max-w-4xl flex-col">
			<!-- En-tête avec informations de la soumission -->
			<div class="mb-4 flex items-center justify-between border-b border-base-300 pb-4">
				<div class="flex-1">
					<h3 class="text-lg font-bold">
						{#if submission.type === 'update'}
							Changements proposés (jeu)
						{:else if submission.type === 'translation'}
							{#if submission.currentTranslation}
								Changements proposés (traduction)
							{:else}
								Détails de la nouvelle traduction
							{/if}
						{:else}
							Détails du nouveau jeu
						{/if}
					</h3>
					<div class="mt-2 flex flex-wrap items-center gap-2">
						<div class="badge {getTypeBadge(submission.type, submission.translationId)}">
							{getTypeLabel(submission.type)}
						</div>
						{#if submission.status}
							{@const statusBadge = getStatusBadge(submission.status)}
							{@const StatusIcon = statusBadge.icon}
							<div class="badge {statusBadge.class} gap-1">
								<StatusIcon size={14} />
								{statusBadge.label}
							</div>
						{/if}
						{#if $user?.role === 'superadmin'}
							<div
								class="badge max-w-52 overflow-hidden badge-outline badge-sm text-nowrap sm:max-w-none"
							>
								ID: {submission.id}
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Section des détails (scrollable) -->
			<div class="flex-1 overflow-y-auto pr-2">
				{#if submission.type === 'update' && submission.parsedData?.game && submission.currentGame}
					{@const hasAnyChanges = gameFields.some((field) => {
						if (!submission?.currentGame || !submission?.parsedData?.game) {
							return false;
						}
						const oldValue = getFieldValue(submission.currentGame, String(field.key));
						const newValue = getFieldValue(submission.parsedData.game, String(field.key));
						return !valuesAreEqual(oldValue, newValue);
					})}
					{#if hasAnyChanges}
						<div class="space-y-4">
							{#each gameFields as field (field.key)}
								{@const oldValue = getFieldValue(submission.currentGame, field.key)}
								{@const newValue = getFieldValue(submission.parsedData.game, field.key)}
								{@const fieldKey = String(field.key)}
								{#if !valuesAreEqual(oldValue, newValue)}
									{@const formattedOld = formatFieldValue(
										oldValue,
										field.options?.showIfEmpty ?? false,
										String(field.key)
									)}
									{@const formattedNew = formatFieldValue(
										newValue,
										field.options?.showIfEmpty ?? false,
										String(field.key)
									)}
									{@const classes = `${
										field.options?.isMultiline || field.options?.isUrl ? 'text-sm' : ''
									} ${field.options?.isUrl ? 'break-all' : ''} ${
										field.options?.isMultiline ? 'whitespace-pre-wrap' : ''
									}`.trim()}
									<div class="border-b border-base-300 pb-3">
										<div class="mb-2 font-semibold">{field.label}:</div>
										<div class="space-y-1">
											{#if (fieldKey === 'translatorId' || fieldKey === 'proofreaderId') && oldValue}
												{@const oldTranslator = getTranslator(oldValue)}
												{#if oldTranslator?.userId}
													<button
														type="button"
														class="link link-error {classes} line-through"
														onclick={() => handleTranslatorClick(oldValue)}
													>
														{formattedOld}
													</button>
												{:else}
													<div class="{classes} text-error line-through">{formattedOld}</div>
												{/if}
											{:else}
												<div class="{classes} text-error line-through">{formattedOld}</div>
											{/if}
											{#if (fieldKey === 'translatorId' || fieldKey === 'proofreaderId') && newValue}
												{@const newTranslator = getTranslator(newValue)}
												{#if newTranslator?.userId}
													<button
														type="button"
														class="link link-success {classes} {field.options?.isMultiline ||
														field.options?.isUrl
															? ''
															: 'font-medium'}"
														onclick={() => handleTranslatorClick(newValue)}
													>
														{formattedNew}
													</button>
												{:else}
													<div
														class="{classes} {field.options?.isMultiline || field.options?.isUrl
															? ''
															: 'font-medium'} text-success"
													>
														{formattedNew}
													</div>
												{/if}
											{:else}
												<div
													class="{classes} {field.options?.isMultiline || field.options?.isUrl
														? ''
														: 'font-medium'} text-success"
												>
													{formattedNew}
												</div>
											{/if}
										</div>
									</div>
								{/if}
							{/each}
						</div>
					{:else}
						<div class="alert alert-info">
							<span
								>Aucun changement détecté entre le jeu actuel et les modifications proposées.</span
							>
						</div>
					{/if}
				{:else if submission.type === 'game' && (submission.currentGame || submission.parsedData?.game)}
					{#if submission.currentGame || submission.parsedData?.game}
						{@const gameData =
							submission.status === 'accepted'
								? submission.parsedData?.game
								: submission.currentGame || submission.parsedData?.game}
						<div class="space-y-4">
							<h4 class="text-md mb-2 font-semibold">Détails du jeu</h4>
							{#each gameFields as field (field.key)}
								{@const value = getFieldValue(gameData!, field.key)}
								{@const formattedValue = formatFieldValue(
									value,
									field.options?.showIfEmpty ?? false,
									String(field.key)
								)}
								{@const fieldKey = String(field.key)}
								{#if formattedValue !== '' || field.options?.showIfEmpty}
									{@const classes = `${
										field.options?.isMultiline || field.options?.isUrl ? 'text-sm' : ''
									} ${field.options?.isUrl ? 'break-all' : ''} ${
										field.options?.isMultiline ? 'whitespace-pre-wrap' : ''
									}`.trim()}
									<div class="border-b border-base-300 pb-3">
										<div class="mb-2 font-semibold">{field.label}:</div>
										{#if (fieldKey === 'translatorId' || fieldKey === 'proofreaderId') && value}
											{@const translator = getTranslator(value)}
											{#if translator?.userId}
												<button
													type="button"
													class="link link-primary {classes}"
													onclick={() => handleTranslatorClick(value)}
												>
													{formattedValue}
												</button>
											{:else}
												<div class={classes}>{formattedValue}</div>
											{/if}
										{:else}
											<div class={classes}>{formattedValue}</div>
										{/if}
									</div>
								{/if}
							{/each}
							{#if submission.currentTranslation || submission.parsedData?.translation}
								{@const translationData =
									submission.status === 'accepted'
										? submission.parsedData?.translation
										: submission.currentTranslation || submission.parsedData?.translation}
								<div class="mt-6">
									<h4 class="text-md mb-2 font-semibold">Détails de la traduction</h4>
									{#each translationFields as field (field.key)}
										{@const value = getFieldValue(translationData!, field.key)}
										{@const formattedValue = formatFieldValue(
											value,
											field.options?.showIfEmpty ?? false,
											String(field.key)
										)}
										{#if formattedValue !== '' || field.options?.showIfEmpty}
											{@const classes = `${
												field.options?.isMultiline || field.options?.isUrl ? 'text-sm' : ''
											} ${field.options?.isUrl ? 'break-all' : ''} ${
												field.options?.isMultiline ? 'whitespace-pre-wrap' : ''
											}`.trim()}
											<div class="border-b border-base-300 pb-3">
												<div class="mb-2 font-semibold">{field.label}:</div>
												<div class={classes}>{formattedValue}</div>
											</div>
										{/if}
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				{:else if submission.type === 'translation' && (submission.currentTranslation || submission.parsedData?.translation)}
					{#if submission.currentTranslation || submission.parsedData?.translation}
						{@const translationData =
							submission.status === 'accepted'
								? submission.parsedData?.translation
								: submission.currentTranslation || submission.parsedData?.translation}
						{#if submission.currentTranslation && submission.parsedData?.translation && submission.status !== 'accepted'}
							{@const hasAnyChanges = translationFields.some((field) => {
								if (!submission?.currentTranslation || !submission?.parsedData?.translation) {
									return false;
								}
								const oldValue = getFieldValue(submission.currentTranslation, String(field.key));
								const newValue = getFieldValue(
									submission.parsedData.translation,
									String(field.key)
								);
								return !valuesAreEqual(oldValue, newValue);
							})}
							{#if hasAnyChanges}
								<div class="space-y-4">
									{#each translationFields as field (field.key)}
										{@const oldValue = getFieldValue(submission.currentTranslation, field.key)}
										{@const newValue = getFieldValue(submission.parsedData.translation, field.key)}
										{@const fieldKey = String(field.key)}
										{#if !valuesAreEqual(oldValue, newValue)}
											{@const formattedOld = formatFieldValue(
												oldValue,
												field.options?.showIfEmpty ?? false,
												String(field.key)
											)}
											{@const formattedNew = formatFieldValue(
												newValue,
												field.options?.showIfEmpty ?? false,
												String(field.key)
											)}
											{@const classes = `${
												field.options?.isMultiline || field.options?.isUrl ? 'text-sm' : ''
											} ${field.options?.isUrl ? 'break-all' : ''} ${
												field.options?.isMultiline ? 'whitespace-pre-wrap' : ''
											}`.trim()}
											<div class="border-b border-base-300 pb-3">
												<div class="mb-2 font-semibold">{field.label}:</div>
												<div class="space-y-1">
													{#if (fieldKey === 'translatorId' || fieldKey === 'proofreaderId') && oldValue}
														{@const oldTranslator = getTranslator(oldValue)}
														{#if oldTranslator?.userId}
															<button
																type="button"
																class="link link-error {classes} line-through"
																onclick={() => handleTranslatorClick(oldValue)}
															>
																{formattedOld}
															</button>
														{:else}
															<div class="{classes} text-error line-through">{formattedOld}</div>
														{/if}
													{:else}
														<div class="{classes} text-error line-through">{formattedOld}</div>
													{/if}
													{#if (fieldKey === 'translatorId' || fieldKey === 'proofreaderId') && newValue}
														{@const newTranslator = getTranslator(newValue)}
														{#if newTranslator?.userId}
															<button
																type="button"
																class="link link-success {classes} {field.options?.isMultiline ||
																field.options?.isUrl
																	? ''
																	: 'font-medium'}"
																onclick={() => handleTranslatorClick(newValue)}
															>
																{formattedNew}
															</button>
														{:else}
															<div
																class="{classes} {field.options?.isMultiline || field.options?.isUrl
																	? ''
																	: 'font-medium'} text-success"
															>
																{formattedNew}
															</div>
														{/if}
													{:else}
														<div
															class="{classes} {field.options?.isMultiline || field.options?.isUrl
																? ''
																: 'font-medium'} text-success"
														>
															{formattedNew}
														</div>
													{/if}
												</div>
											</div>
										{/if}
									{/each}
								</div>
							{:else}
								<div class="alert alert-info">
									<span
										>Aucun changement détecté entre la traduction actuelle et les modifications
										proposées.</span
									>
								</div>
							{/if}
						{:else}
							<div class="space-y-4">
								{#each translationFields as field (field.key)}
									{@const value = getFieldValue(translationData!, field.key)}
									{@const formattedValue = formatFieldValue(
										value,
										field.options?.showIfEmpty ?? false,
										String(field.key)
									)}
									{#if formattedValue !== '' || field.options?.showIfEmpty}
										{@const classes = `${
											field.options?.isMultiline || field.options?.isUrl ? 'text-sm' : ''
										} ${field.options?.isUrl ? 'break-all' : ''} ${
											field.options?.isMultiline ? 'whitespace-pre-wrap' : ''
										}`.trim()}
										<div class="border-b border-base-300 pb-3">
											<div class="mb-2 font-semibold">{field.label}:</div>
											<div class={classes}>{formattedValue}</div>
										</div>
									{/if}
								{/each}
							</div>
						{/if}
					{/if}
				{/if}
			</div>

			{#if canEditSubmissionDataAllowed}
				<div class="mt-6 border-t border-base-300 pt-4">
					<h4 class="text-md mb-4 font-semibold">
						{#if canEditSubmissionDataAsAdmin}
							Modifier les données (admin / superadmin)
						{:else}
							Modifier les données de la soumission
						{/if}
					</h4>

					{#if submissionEditError}
						<div class="mb-4 alert alert-error">
							<span>{submissionEditError}</span>
						</div>
					{/if}

					<form
						method="POST"
						action="?/updateSubmissionData"
						use:enhance={() => {
							submissionEditError = null;
							return async function ({ result, update }) {
								if (result.type === 'success') {
									await update({ invalidateAll: true });
									onClose();
								} else if (result.type === 'failure' && result.data) {
									const message =
										typeof result.data === 'object' && 'message' in result.data
											? String(result.data.message)
											: 'Erreur lors de la mise à jour';
									submissionEditError = message;
								}
							};
						}}
					>
						<input type="hidden" name="submissionId" value={submission.id} />

						<!-- Envoyer le JSON au serveur sans l'exposer à l'utilisateur -->
						<input type="hidden" name="submissionDataJson" value={submissionDataJsonHidden} />

						{#if submission.type !== 'translation'}
							<div class="mt-2 space-y-4">
								<h5 class="text-md font-semibold">Détails du jeu</h5>

								<div class="grid gap-4 md:grid-cols-2">
									<div class="form-control">
										<label class="label" for="editGameName">
											<span class="label-text">Nom</span>
										</label>
										<input
											id="editGameName"
											name="editGameName"
											class="input-bordered input w-full"
											type="text"
											bind:value={editGameName}
											required
										/>
									</div>

									<div class="form-control md:col-span-2">
										<label class="label" for="editGameType">
											<span class="label-text"
												>Moteur — appliqué à toutes les lignes (fiche jeu)</span
											>
										</label>
										<select
											id="editGameType"
											name="editGameType"
											class="select-bordered select w-full"
											bind:value={editGameType}
											required
										>
											<option value="renpy">Ren'Py</option>
											<option value="rpgm">RPGM</option>
											<option value="unity">Unity</option>
											<option value="unreal">Unreal</option>
											<option value="flash">Flash</option>
											<option value="html">HTML</option>
											<option value="qsp">QSP</option>
											<option value="other">Autre</option>
										</select>
									</div>

									<div class="form-control">
										<label class="label" for="editGameWebsite">
											<span class="label-text">Site web</span>
										</label>
										<select
											id="editGameWebsite"
											name="editGameWebsite"
											class="select-bordered select w-full"
											bind:value={editGameWebsite}
											required
										>
											<option value="f95z">F95Zone</option>
											<option value="lc">LewdCorner</option>
											<option value="other">Autre</option>
										</select>
									</div>

									<div class="form-control">
										<label class="label" for="editGameThreadId">
											<span class="label-text">Thread ID</span>
										</label>
										<input
											id="editGameThreadId"
											name="editGameThreadId"
											class="input-bordered input w-full"
											type="text"
											placeholder="(vide)"
											bind:value={editGameThreadId}
										/>
									</div>

									<div class="form-control">
										<label class="label" for="editGameGameVersion">
											<span class="label-text">Version jeu (fiche)</span>
										</label>
										<input
											id="editGameGameVersion"
											name="editGameGameVersion"
											class="input-bordered input w-full"
											type="text"
											bind:value={editGameGameVersion}
										/>
									</div>

									<div class="form-control">
										<label class="label" for="editGameLink">
											<span class="label-text">Lien</span>
										</label>
										<input
											id="editGameLink"
											name="editGameLink"
											class="input-bordered input w-full"
											type="url"
											placeholder="https://..."
											bind:value={editGameLink}
										/>
									</div>

									<div class="form-control md:col-span-2">
										<label class="label" for="editGameImage">
											<span class="label-text">Image</span>
										</label>
										<input
											id="editGameImage"
											name="editGameImage"
											class="input-bordered input w-full"
											type="url"
											placeholder="https://..."
											bind:value={editGameImage}
											required
										/>
									</div>

									<div class="form-control md:col-span-2">
										<label class="label" for="editGameTags">
											<span class="label-text">Tags</span>
										</label>
										<textarea
											id="editGameTags"
											name="editGameTags"
											class="textarea-bordered textarea w-full"
											rows="3"
											bind:value={editGameTags}
										></textarea>
									</div>

									<div class="form-control md:col-span-2">
										<label class="label" for="editGameDescription">
											<span class="label-text">Description</span>
										</label>
										<textarea
											id="editGameDescription"
											name="editGameDescription"
											class="textarea-bordered textarea w-full"
											rows="3"
											bind:value={editGameDescription}
										></textarea>
									</div>
								</div>
							</div>
						{/if}

						{#if submission.type === 'translation' || submission.parsedData?.translation}
							<div class="mt-6 space-y-4">
								<h5 class="text-md font-semibold">Détails de la traduction</h5>

								<div class="grid gap-4 md:grid-cols-2">
									<div class="form-control md:col-span-2">
										<label class="label" for="editTranslationTranslationName">
											<span class="label-text">Nom de traduction</span>
										</label>
										<input
											id="editTranslationTranslationName"
											name="editTranslationTranslationName"
											class="input-bordered input w-full"
											type="text"
											placeholder="(vide)"
											bind:value={editTranslationTranslationName}
										/>
									</div>

									<div class="form-control">
										<label class="label" for="editTranslationVersion">
											<span class="label-text">Version de référence</span>
										</label>
										<input
											id="editTranslationVersion"
											name="editTranslationVersion"
											class="input-bordered input w-full"
											type="text"
											bind:value={editTranslationVersion}
										/>
									</div>

									<div class="form-control">
										<label class="label" for="editTranslationTversion">
											<span class="label-text">Version traduction</span>
										</label>
										<input
											id="editTranslationTversion"
											name="editTranslationTversion"
											class="input-bordered input w-full"
											type="text"
											bind:value={editTranslationTversion}
											required
										/>
									</div>

									<div class="form-control">
										<label class="label" for="editTranslationTname">
											<span class="label-text">Statut de traduction</span>
										</label>
										<select
											id="editTranslationTname"
											name="editTranslationTname"
											class="select-bordered select w-full"
											bind:value={editTranslationTname}
											required
										>
											<option value="no_translation">Pas de traduction</option>
											<option value="integrated">Intégrée</option>
											<option value="translation">Traduction</option>
											<option value="translation_with_mods">Traduction avec mods</option>
										</select>
									</div>

									<div class="form-control">
										<label class="label" for="editTranslationStatus">
											<span class="label-text">Statut</span>
										</label>
										<select
											id="editTranslationStatus"
											name="editTranslationStatus"
											class="select-bordered select w-full"
											bind:value={editTranslationStatus}
											required
										>
											<option value="in_progress">En cours</option>
											<option value="completed">Terminé</option>
											<option value="abandoned">Abandonné</option>
										</select>
									</div>

									<div class="form-control">
										<label class="label" for="editTranslationGameType">
											<span class="label-text">Moteur (cette ligne)</span>
										</label>
										<select
											id="editTranslationGameType"
											name="editTranslationGameType"
											class="select-bordered select w-full"
											bind:value={editTranslationGameType}
											required
										>
											<option value="renpy">Ren'Py</option>
											<option value="rpgm">RPGM</option>
											<option value="unity">Unity</option>
											<option value="unreal">Unreal</option>
											<option value="flash">Flash</option>
											<option value="html">HTML</option>
											<option value="qsp">QSP</option>
											<option value="other">Autre</option>
										</select>
									</div>

									<div class="form-control">
										<label class="label" for="editTranslationTtype">
											<span class="label-text">Type de traduction</span>
										</label>
										<select
											id="editTranslationTtype"
											name="editTranslationTtype"
											class="select-bordered select w-full"
											bind:value={editTranslationTtype}
											required
										>
											<option value="auto">Auto</option>
											<option value="vf">VF</option>
											<option value="manual">Manual</option>
											<option value="semi-auto">Semi-auto</option>
											<option value="to_tested">À tester</option>
											<option value="hs">HS</option>
										</select>
									</div>

									<div class="form-control">
										<label class="label" for="editTranslationTlink">
											<span class="label-text">Lien de traduction</span>
										</label>
										<input
											id="editTranslationTlink"
											name="editTranslationTlink"
											class="input-bordered input w-full"
											type="url"
											placeholder="(vide)"
											bind:value={editTranslationTlink}
										/>
									</div>

									<div class="form-control md:col-span-2">
										<label class="label cursor-pointer justify-start gap-3">
											<input
												type="checkbox"
												class="checkbox checkbox-sm"
												bind:checked={editTranslationAc}
											/>
											<span class="label-text">Auto-Check</span>
										</label>
									</div>

									<div class="form-control">
										<label class="label" for="editTranslationTranslatorId">
											<span class="label-text">Traducteur</span>
										</label>
										<select
											id="editTranslationTranslatorId"
											name="editTranslationTranslatorId"
											class="select-bordered select w-full"
											bind:value={editTranslationTranslatorId}
										>
											<option value="">(vide)</option>
											{#each translators as translator (translator.id)}
												<option value={translator.id}>{translator.name}</option>
											{/each}
										</select>
									</div>

									<div class="form-control">
										<label class="label" for="editTranslationProofreaderId">
											<span class="label-text">Relecteur</span>
										</label>
										<select
											id="editTranslationProofreaderId"
											name="editTranslationProofreaderId"
											class="select-bordered select w-full"
											bind:value={editTranslationProofreaderId}
										>
											<option value="">(vide)</option>
											{#each translators as translator (translator.id)}
												<option value={translator.id}>{translator.name}</option>
											{/each}
										</select>
									</div>
								</div>
							</div>
						{/if}

						<div class="modal-action mt-4">
							<button type="button" class="btn" onclick={onClose}> Annuler </button>
							<button type="submit" class="btn btn-primary"> Enregistrer </button>
						</div>
					</form>
				</div>
			{/if}

			{#if canCancelSubmission}
				<div class="mt-4 border-t border-base-300 pt-4">
					<form
						method="POST"
						action="?/cancelSubmission"
						use:enhance={() => {
							submissionEditError = null;
							return async function ({ result, update }) {
								if (result.type === 'success') {
									await update({ invalidateAll: true });
									onClose();
								} else if (result.type === 'failure' && result.data) {
									const message =
										typeof result.data === 'object' && 'message' in result.data
											? String(result.data.message)
											: "Erreur lors de l'annulation";
									submissionEditError = message;
								}
							};
						}}
					>
						<input type="hidden" name="submissionId" value={submission.id} />
						<div class="modal-action mt-0">
							<button type="submit" class="btn btn-outline btn-error">Annuler la soumission</button>
						</div>
					</form>
				</div>
			{/if}

			<!-- Section de modification du statut -->
			{#if canEditStatus}
				<div class="mt-6 border-t border-base-300 pt-4">
					<h4 class="text-md mb-4 font-semibold">Modifier le statut</h4>

					{#if statusError}
						<div class="mb-4 alert alert-error">
							<span>{statusError}</span>
						</div>
					{/if}

					<form
						method="POST"
						action="?/updateStatus"
						use:enhance={(e) => {
							statusError = null;

							const validationError = validateStatusChange(selectedStatus, adminNotesText);
							if (validationError) {
								e.cancel();
								statusError = validationError;
								return;
							}

							return async function ({ result, update }) {
								if (result.type === 'success') {
									await update({ invalidateAll: true });
									onClose();
								} else if (result.type === 'failure' && result.data) {
									const message =
										typeof result.data === 'object' && 'message' in result.data
											? String(result.data.message)
											: 'Erreur lors de la mise à jour';
									statusError = message;
								}
							};
						}}
					>
						<input type="hidden" name="submissionId" value={submission.id} />

						<div class="form-control w-full">
							<label for="status" class="label">
								<span class="label-text">Statut</span>
							</label>
							<select
								id="status"
								name="status"
								class="select-bordered select w-full"
								class:select-error={statusError}
								bind:value={selectedStatus}
								required
							>
								<option value="pending">En attente</option>
								<option value="opened">Ouverte</option>
								<option value="accepted">Acceptée</option>
								<option value="rejected">Refusée</option>
							</select>
						</div>

						<div class="form-control mt-4 w-full">
							<label for="adminNotes" class="label">
								<span class="label-text">Notes admin</span>
								{#if isRejected}
									<span class="label-text-alt text-error">* Obligatoire</span>
								{:else}
									<span class="label-text-alt">(optionnel)</span>
								{/if}
							</label>
							<textarea
								id="adminNotes"
								name="adminNotes"
								class="textarea-bordered textarea w-full"
								class:textarea-error={hasNotesError}
								placeholder={isRejected
									? 'Vous devez expliquer pourquoi cette soumission est refusée...'
									: 'Ajouter des notes pour cette soumission...'}
								rows="3"
								required={isRejected}
								bind:value={adminNotesText}
							></textarea>
							{#if isRejected}
								<div class="label">
									<span class="label-text-alt text-error"
										>Une note est obligatoire pour refuser une soumission</span
									>
								</div>
							{/if}
						</div>

						<div class="modal-action mt-4">
							<button type="button" class="btn" onclick={onClose}> Annuler </button>
							<button type="submit" class="btn btn-primary"> Enregistrer </button>
						</div>
					</form>
				</div>
			{:else}
				<div class="modal-action mt-4">
					<button type="button" class="btn" onclick={onClose}> Fermer </button>
				</div>
			{/if}
		</div>
		<button type="button" class="modal-backdrop" onclick={onClose} aria-label="Fermer la modal"
		></button>
	</div>
{/if}
