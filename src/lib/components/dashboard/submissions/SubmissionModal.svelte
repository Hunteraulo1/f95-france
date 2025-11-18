<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import type { Game, GameTranslation } from '$lib/server/db/schema';
	import { user } from '$lib/stores';
	import { getStatusBadge, getTypeBadge, getTypeLabel, validateStatusChange } from '$lib/utils/submissions';

	interface FieldConfig<T extends GameTranslation | Game = GameTranslation | Game> {
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
			game?: Game;
			translation?: GameTranslation;
		} | null;
		currentGame?: Game | null;
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

	$effect(() => {
		if (submission) {
			selectedStatus = submission.status;
			adminNotesText = submission.adminNotes || '';
			statusError = null;
		}
	});

	const isRejected = $derived(selectedStatus === 'rejected');
	const hasNotesError = $derived(isRejected && (!adminNotesText || adminNotesText.trim() === ''));

	const gameFields: FieldConfig<Game>[] = [
		{ key: 'name', label: 'Nom' },
		{ key: 'description', label: 'Description', options: { isMultiline: true, showIfEmpty: true } },
		{ key: 'type', label: 'Type' },
		{ key: 'website', label: 'Site web' },
		{ key: 'threadId', label: 'Thread ID', options: { showIfEmpty: true } },
		{ key: 'tags', label: 'Tags', options: { isMultiline: true, showIfEmpty: true } },
		{ key: 'link', label: 'Lien', options: { isUrl: true, showIfEmpty: true } },
		{ key: 'image', label: 'Image', options: { isUrl: true } }
	];

	const translationFields: FieldConfig<GameTranslation>[] = [
		{ key: 'translationName', label: 'Nom de traduction' },
		{ key: 'tname', label: 'Status de la traduction', options: { showIfEmpty: true } },
		{ key: 'version', label: 'Version' },
		{ key: 'tversion', label: 'Version traduction' },
		{ key: 'status', label: 'Statut' },
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

	const getTranslatorName = (translatorId: string | null | undefined): string | null => {
		if (!translatorId) return null;
		const translator = translators.find((t) => t.id === translatorId);
		return translator?.name || null;
	};

	const getTranslator = (translatorId: string | null | undefined): Translator | null => {
		if (!translatorId) return null;
		return translators.find((t) => t.id === translatorId) || null;
	};

	const handleTranslatorClick = async (translatorId: string | null | undefined) => {
		const translator = getTranslator(translatorId);
		if (translator?.userId) {
			await goto(`/dashboard/profile/${translator.userId}`);
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
			const translatorName = getTranslatorName(value as string);
			return translatorName || String(value);
		}

		if (typeof value === 'boolean') {
			return value ? 'Oui' : 'Non';
		}

		return String(value);
	};
</script>

{#if submission}
	<div class="modal-open modal">
		<div class="modal-box max-h-[90vh] max-w-4xl flex flex-col">
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
					<div class="mt-2 flex items-center gap-2">
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
							<div class="badge badge-outline badge-sm">
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
						const oldValue = getFieldValue(submission.currentGame, field.key as string);
						const newValue = getFieldValue(submission.parsedData.game, field.key as string);
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
										field.key as string
									)}
									{@const formattedNew = formatFieldValue(
										newValue,
										field.options?.showIfEmpty ?? false,
										field.key as string
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
												{@const oldTranslator = getTranslator(oldValue as string)}
												{#if oldTranslator?.userId}
													<button
														type="button"
														class="link link-error {classes} line-through"
														onclick={() => handleTranslatorClick(oldValue as string)}
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
												{@const newTranslator = getTranslator(newValue as string)}
												{#if newTranslator?.userId}
													<button
														type="button"
														class="link link-success {classes} {field.options?.isMultiline || field.options?.isUrl
															? ''
															: 'font-medium'}"
														onclick={() => handleTranslatorClick(newValue as string)}
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
							<span>Aucun changement détecté entre le jeu actuel et les modifications proposées.</span>
						</div>
					{/if}
				{:else if submission.type === 'game' && (submission.currentGame || submission.parsedData?.game)}
					{#if submission.currentGame || submission.parsedData?.game}
						{@const gameData = submission.status === 'accepted' 
							? submission.parsedData?.game 
							: (submission.currentGame || submission.parsedData?.game)}
						<div class="space-y-4">
							<h4 class="text-md font-semibold mb-2">Détails du jeu</h4>
							{#each gameFields as field (field.key)}
								{@const value = getFieldValue(gameData!, field.key)}
							{@const formattedValue = formatFieldValue(
								value,
								field.options?.showIfEmpty ?? false,
								field.key as string
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
										{@const translator = getTranslator(value as string)}
										{#if translator?.userId}
											<button
												type="button"
												class="link link-primary {classes}"
												onclick={() => handleTranslatorClick(value as string)}
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
							{@const translationData = submission.status === 'accepted' 
								? submission.parsedData?.translation 
								: (submission.currentTranslation || submission.parsedData?.translation)}
							<div class="mt-6">
								<h4 class="text-md font-semibold mb-2">Détails de la traduction</h4>
								{#each translationFields as field (field.key)}
									{@const value = getFieldValue(translationData!, field.key)}
									{@const formattedValue = formatFieldValue(
										value,
										field.options?.showIfEmpty ?? false,
										field.key as string
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
						{@const translationData = submission.status === 'accepted' 
							? submission.parsedData?.translation 
							: (submission.currentTranslation || submission.parsedData?.translation)}
						{#if submission.currentTranslation && submission.parsedData?.translation && submission.status !== 'accepted'}
							{@const hasAnyChanges = translationFields.some((field) => {
							if (!submission?.currentTranslation || !submission?.parsedData?.translation) {
								return false;
							}
							const oldValue = getFieldValue(submission.currentTranslation, field.key as string);
							const newValue = getFieldValue(submission.parsedData.translation, field.key as string);
							return !valuesAreEqual(oldValue, newValue);
						})}
						{#if hasAnyChanges}
							<div class="space-y-4">
								{#each translationFields as field (field.key)}
									{@const oldValue = getFieldValue(submission.currentTranslation, field.key)}
									{@const newValue = getFieldValue(
										submission.parsedData.translation,
										field.key
									)}
									{@const fieldKey = String(field.key)}
									{#if !valuesAreEqual(oldValue, newValue)}
										{@const formattedOld = formatFieldValue(
											oldValue,
											field.options?.showIfEmpty ?? false,
											field.key as string
										)}
										{@const formattedNew = formatFieldValue(
											newValue,
											field.options?.showIfEmpty ?? false,
											field.key as string
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
													{@const oldTranslator = getTranslator(oldValue as string)}
													{#if oldTranslator?.userId}
														<button
															type="button"
															class="link link-error {classes} line-through"
															onclick={() => handleTranslatorClick(oldValue as string)}
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
													{@const newTranslator = getTranslator(newValue as string)}
													{#if newTranslator?.userId}
														<button
															type="button"
															class="link link-success {classes} {field.options?.isMultiline || field.options?.isUrl
																? ''
																: 'font-medium'}"
															onclick={() => handleTranslatorClick(newValue as string)}
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
								<span>Aucun changement détecté entre la traduction actuelle et les modifications proposées.</span>
							</div>
						{/if}
						{:else}
							<div class="space-y-4">
								{#each translationFields as field (field.key)}
									{@const value = getFieldValue(translationData!, field.key)}
								{@const formattedValue = formatFieldValue(
									value,
									field.options?.showIfEmpty ?? false,
									field.key as string
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

			<!-- Section de modification du statut -->
			{#if canEditStatus}
				<div class="mt-6 border-t border-base-300 pt-4">
					<h4 class="mb-4 text-md font-semibold">Modifier le statut</h4>

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

							return async ({ result, update }) => {
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
		<button
			type="button"
			class="modal-backdrop"
			onclick={onClose}
			aria-label="Fermer la modal"
		></button>
	</div>
{/if}
