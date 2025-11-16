<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { CircleCheck, CircleX, Clock, Eye, User } from '@lucide/svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let showStatusModal = $state(false);
	let showChangesModal = $state(false);
	let selectedSubmission: (typeof data.submissions)[0] | null = $state(null);
	let statusError = $state<string | null>(null);
	let selectedStatus = $state<string>('pending');
	let adminNotesText = $state<string>('');

	const openStatusModal = (submission: (typeof data.submissions)[0]) => {
		selectedSubmission = submission;
		selectedStatus = submission.status;
		adminNotesText = submission.adminNotes || '';
		showStatusModal = true;
		statusError = null;
	};

	const closeStatusModal = () => {
		showStatusModal = false;
		selectedSubmission = null;
		statusError = null;
		adminNotesText = '';
	};

	const openChangesModal = (submission: (typeof data.submissions)[0]) => {
		selectedSubmission = submission;
		showChangesModal = true;
	};

	const closeChangesModal = () => {
		showChangesModal = false;
		selectedSubmission = null;
	};

	const getStatusBadge = (status: string) => {
		switch (status) {
			case 'pending':
				return { label: 'En attente', class: 'badge-warning', icon: Clock };
			case 'accepted':
				return { label: 'Acceptée', class: 'badge-success', icon: CircleCheck };
			case 'rejected':
				return { label: 'Refusée', class: 'badge-error', icon: CircleX };
			default:
				return { label: status, class: 'badge-neutral', icon: Clock };
		}
	};

	const getTypeLabel = (type: string) => {
		switch (type) {
			case 'game':
				return 'Jeu';
			case 'translation':
				return 'Traduction';
			case 'update':
				return 'Mise à jour';
			case 'delete':
				return 'Suppression';
			default:
				return type;
		}
	};

	const getTypeBadge = (type: string, translationId?: string | null) => {
		// Si c'est une suppression, toujours rouge
		if (type === 'delete') {
			return translationId ? 'badge-error' : 'badge-error';
		}

		// Si c'est une traduction (ajout)
		if (type === 'translation' && !translationId) {
			return 'badge-info'; // Bleu pour ajout de traduction
		}

		// Si c'est une modification de traduction
		if (type === 'translation' && translationId) {
			return 'badge-warning'; // Orange pour modification de traduction
		}

		// Si c'est un ajout de jeu
		if (type === 'game') {
			return 'badge-success'; // Vert pour ajout de jeu
		}

		// Si c'est une modification de jeu
		if (type === 'update') {
			return 'badge-warning'; // Orange pour modification de jeu
		}

		return 'badge-outline'; // Par défaut
	};

	const updateFilter = async (status: string) => {
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		await goto(`/dashboard/submits?status=${status}`, { noScroll: true, invalidateAll: true });
	};
</script>

<section class="flex flex-col gap-4">
	<div class="flex items-center justify-between">
		<h2 class="text-lg font-semibold text-base-content">
			Soumissions
			<span class="text-sm font-normal opacity-70">
				({data.submissions.length} soumission{data.submissions.length > 1 ? 's' : ''})
			</span>
		</h2>
	</div>

	<!-- Filtres -->
	<div class="flex gap-2">
		<button
			class="btn btn-sm"
			class:btn-active={data.statusFilter === 'pending'}
			onclick={() => updateFilter('pending')}
		>
			En attente
			{#if data.pendingCount > 0}
				<div class="ml-2 badge badge-sm badge-primary">{data.pendingCount}</div>
			{/if}
		</button>
		<button
			class="btn btn-sm"
			class:btn-active={data.statusFilter === 'accepted'}
			onclick={() => updateFilter('accepted')}
		>
			Acceptées
			{#if data.acceptedCount > 0}
				<div class="ml-2 badge badge-sm badge-success">{data.acceptedCount}</div>
			{/if}
		</button>
		<button
			class="btn btn-sm"
			class:btn-active={data.statusFilter === 'rejected'}
			onclick={() => updateFilter('rejected')}
		>
			Refusées
		</button>
		<button
			class="btn btn-sm"
			class:btn-active={data.statusFilter === 'all'}
			onclick={() => updateFilter('all')}
		>
			Toutes
		</button>
	</div>

	{#if data.submissions.length === 0}
		<div class="card bg-base-100 p-8 shadow-sm">
			<div class="text-center">
				<p class="text-lg opacity-70">
					Aucune soumission {data.statusFilter === 'pending'
						? 'en attente'
						: data.statusFilter === 'accepted'
							? 'acceptée'
							: data.statusFilter === 'rejected'
								? 'refusée'
								: ''}
				</p>
			</div>
		</div>
	{:else}
		<div class="grid gap-4">
			{#each data.submissions as submission (submission.id)}
				{@const statusBadge = getStatusBadge(submission.status)}
				{@const StatusIcon = statusBadge.icon}
				<div class="card bg-base-100 shadow-sm">
					<div class="card-body">
						<div class="flex items-start justify-between gap-4">
							<div class="flex-1">
								<div class="mb-2 flex items-center gap-3">
									{#if submission.user}
										<div class="mb-2 flex items-center justify-center gap-2">
											<div class="avatar">
												<div class="mask flex h-8 w-8 items-center justify-center mask-squircle">
													{#if submission.user.avatar}
														<img
															src={submission.user.avatar}
															alt={submission.user.username}
															class="h-8 w-8 rounded-full object-cover"
														/>
													{:else}
														<User size={24} />
													{/if}
												</div>
											</div>
											<span class="text-sm opacity-70">{submission.user.username}</span>
										</div>
									{/if}
									<div class="mb-2 flex items-center gap-3">
										<div class="badge {getTypeBadge(submission.type, submission.translationId)}">
											{getTypeLabel(submission.type)}
										</div>
										<div class="badge {statusBadge.class} gap-1">
											<StatusIcon size={14} />
											{statusBadge.label}
										</div>
									</div>
								</div>

								<div class="mt-2 flex items-center gap-2">
									{#if submission.game}
										{#if submission.game.image}
											<img
												src={submission.game.image}
												alt={submission.game.name}
												class="h-10 w-10 rounded object-cover"
											/>
										{/if}
										<div class="flex flex-col">
											<span class="text-sm font-medium">{submission.game.name}</span>
											{#if submission.translation}
												<span class="text-xs opacity-70">
													Traduction: {submission.translation.version}
													{#if submission.translation.tversion}
														- {submission.translation.tversion}
													{/if}
													{#if submission.translation.translationName}
														({submission.translation.translationName})
													{/if}
												</span>
											{/if}
										</div>
									{:else if submission.gameId}
										<span class="text-sm opacity-70">Jeu ID: {submission.gameId}</span>
									{/if}
								</div>

								{#if (submission.type === 'update' && submission.parsedData?.game && submission.currentGame) || (submission.type === 'game' && submission.parsedData?.game) || (submission.type === 'translation' && submission.parsedData?.translation)}
									<div class="mt-2">
										<button
											class="btn btn-outline btn-sm btn-primary"
											onclick={() => openChangesModal(submission)}
										>
											<Eye size={14} />
											Voir les détails
										</button>
									</div>
								{/if}

								{#if submission.adminNotes}
									<div class="mt-2 alert alert-info">
										<span class="text-sm">
											<strong>Notes admin:</strong>
											{submission.adminNotes}
										</span>
									</div>
								{/if}

								<div class="mt-2 text-xs opacity-50">
									Créée le {new Date(submission.createdAt).toLocaleDateString('fr-FR', {
										year: 'numeric',
										month: 'long',
										day: 'numeric',
										hour: '2-digit',
										minute: '2-digit'
									})}
								</div>
							</div>
							<div class="flex gap-2">
								<button class="btn btn-sm btn-primary" onclick={() => openStatusModal(submission)}>
									Modifier le statut
								</button>
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</section>

<!-- Modal de modification du statut -->
{#if showStatusModal && selectedSubmission}
	<div class="modal-open modal">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Modifier le statut de la soumission</h3>

			{#if statusError}
				<div class="mt-4 alert alert-error">
					<span>{statusError}</span>
				</div>
			{/if}

			<form
				method="POST"
				action="?/updateStatus"
				use:enhance={(e) => {
					statusError = null;

					// Validation côté client : si rejected, adminNotes est obligatoire
					if (selectedStatus === 'rejected' && (!adminNotesText || adminNotesText.trim() === '')) {
						e.cancel();
						statusError = 'Une note admin est obligatoire pour refuser une soumission';
						return;
					}

					return async ({ result, update }) => {
						if (result.type === 'success') {
							await update();
							closeStatusModal();
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
				<input type="hidden" name="submissionId" value={selectedSubmission.id} />

				<div class="form-control mt-4 w-full">
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
						{#if selectedStatus === 'rejected'}
							<span class="label-text-alt text-error">* Obligatoire</span>
						{:else}
							<span class="label-text-alt">(optionnel)</span>
						{/if}
					</label>
					<textarea
						id="adminNotes"
						name="adminNotes"
						class="textarea-bordered textarea w-full"
						class:textarea-error={selectedStatus === 'rejected' &&
							(!adminNotesText || adminNotesText.trim() === '')}
						placeholder={selectedStatus === 'rejected'
							? 'Vous devez expliquer pourquoi cette soumission est refusée...'
							: 'Ajouter des notes pour cette soumission...'}
						rows="4"
						required={selectedStatus === 'rejected'}
						bind:value={adminNotesText}
					></textarea>
					{#if selectedStatus === 'rejected'}
						<div class="label">
							<span class="label-text-alt text-error"
								>Une note est obligatoire pour refuser une soumission</span
							>
						</div>
					{/if}
				</div>

				<div class="modal-action">
					<button type="button" class="btn" onclick={closeStatusModal}> Annuler </button>
					<button type="submit" class="btn btn-primary"> Enregistrer </button>
				</div>
			</form>
		</div>
	</div>
{/if}

{#if showChangesModal && selectedSubmission}
	<div class="modal-open modal">
		<div class="modal-box max-h-[90vh] max-w-4xl overflow-y-auto">
			<h3 class="mb-4 text-lg font-bold">
				{#if selectedSubmission.type === 'update'}
					Changements proposés (jeu)
				{:else if selectedSubmission.type === 'translation'}
					{#if selectedSubmission.currentTranslation}
						Changements proposés (traduction)
					{:else}
						Détails de la nouvelle traduction
					{/if}
				{:else}
					Détails du nouveau jeu
				{/if}
			</h3>

			{#if selectedSubmission.type === 'update' && selectedSubmission.parsedData?.game && selectedSubmission.currentGame}
				<div class="space-y-4">
					{#if selectedSubmission.parsedData.game.name !== selectedSubmission.currentGame.name}
						<div class="border-b border-base-300 pb-3">
							<div class="mb-2 font-semibold">Nom:</div>
							<div class="space-y-1">
								<div class="text-sm text-error line-through">
									{selectedSubmission.currentGame.name}
								</div>
								<div class="font-medium text-success">
									{selectedSubmission.parsedData.game.name}
								</div>
							</div>
						</div>
					{/if}
					{#if selectedSubmission.parsedData.game.description !== selectedSubmission.currentGame.description}
						<div class="border-b border-base-300 pb-3">
							<div class="mb-2 font-semibold">Description:</div>
							<div class="space-y-1">
								<div class="text-sm whitespace-pre-wrap text-error line-through">
									{selectedSubmission.currentGame.description || '(vide)'}
								</div>
								<div class="text-sm whitespace-pre-wrap text-success">
									{selectedSubmission.parsedData.game.description || '(vide)'}
								</div>
							</div>
						</div>
					{/if}
					{#if selectedSubmission.parsedData.game.type !== selectedSubmission.currentGame.type}
						<div class="border-b border-base-300 pb-3">
							<div class="mb-2 font-semibold">Type:</div>
							<div class="space-y-1">
								<div class="text-error line-through">{selectedSubmission.currentGame.type}</div>
								<div class="font-medium text-success">
									{selectedSubmission.parsedData.game.type}
								</div>
							</div>
						</div>
					{/if}
					{#if selectedSubmission.parsedData.game.website !== selectedSubmission.currentGame.website}
						<div class="border-b border-base-300 pb-3">
							<div class="mb-2 font-semibold">Site web:</div>
							<div class="space-y-1">
								<div class="text-error line-through">{selectedSubmission.currentGame.website}</div>
								<div class="font-medium text-success">
									{selectedSubmission.parsedData.game.website}
								</div>
							</div>
						</div>
					{/if}
					{#if selectedSubmission.parsedData.game.threadId !== selectedSubmission.currentGame.threadId}
						<div class="border-b border-base-300 pb-3">
							<div class="mb-2 font-semibold">Thread ID:</div>
							<div class="space-y-1">
								<div class="text-error line-through">
									{selectedSubmission.currentGame.threadId || '(vide)'}
								</div>
								<div class="font-medium text-success">
									{selectedSubmission.parsedData.game.threadId || '(vide)'}
								</div>
							</div>
						</div>
					{/if}
					{#if selectedSubmission.parsedData.game.tags !== selectedSubmission.currentGame.tags}
						<div class="border-b border-base-300 pb-3">
							<div class="mb-2 font-semibold">Tags:</div>
							<div class="space-y-1">
								<div class="text-sm whitespace-pre-wrap text-error line-through">
									{selectedSubmission.currentGame.tags || '(vide)'}
								</div>
								<div class="text-sm whitespace-pre-wrap text-success">
									{selectedSubmission.parsedData.game.tags || '(vide)'}
								</div>
							</div>
						</div>
					{/if}
					{#if selectedSubmission.parsedData.game.link !== selectedSubmission.currentGame.link}
						<div class="border-b border-base-300 pb-3">
							<div class="mb-2 font-semibold">Lien:</div>
							<div class="space-y-1">
								<div class="text-sm break-all text-error line-through">
									{selectedSubmission.currentGame.link || '(vide)'}
								</div>
								<div class="text-sm break-all text-success">
									{selectedSubmission.parsedData.game.link || '(vide)'}
								</div>
							</div>
						</div>
					{/if}
					{#if selectedSubmission.parsedData.game.image !== selectedSubmission.currentGame.image}
						<div class="border-b border-base-300 pb-3">
							<div class="mb-2 font-semibold">Image:</div>
							<div class="space-y-1">
								<div class="text-sm break-all text-error line-through">
									{selectedSubmission.currentGame.image}
								</div>
								<div class="text-sm break-all text-success">
									{selectedSubmission.parsedData.game.image}
								</div>
							</div>
						</div>
					{/if}
				</div>
			{:else if selectedSubmission.type === 'game' && selectedSubmission.parsedData?.game}
				<div class="space-y-4">
					<div class="border-b border-base-300 pb-3">
						<div class="mb-2 font-semibold">Nom:</div>
						<div>{selectedSubmission.parsedData.game.name}</div>
					</div>
					{#if selectedSubmission.parsedData.game.description}
						<div class="border-b border-base-300 pb-3">
							<div class="mb-2 font-semibold">Description:</div>
							<div class="text-sm whitespace-pre-wrap">
								{selectedSubmission.parsedData.game.description}
							</div>
						</div>
					{/if}
					<div class="border-b border-base-300 pb-3">
						<div class="mb-2 font-semibold">Type:</div>
						<div>{selectedSubmission.parsedData.game.type}</div>
					</div>
					<div class="border-b border-base-300 pb-3">
						<div class="mb-2 font-semibold">Site web:</div>
						<div>{selectedSubmission.parsedData.game.website}</div>
					</div>
					{#if selectedSubmission.parsedData.game.threadId}
						<div class="border-b border-base-300 pb-3">
							<div class="mb-2 font-semibold">Thread ID:</div>
							<div>{selectedSubmission.parsedData.game.threadId}</div>
						</div>
					{/if}
					{#if selectedSubmission.parsedData.game.tags}
						<div class="border-b border-base-300 pb-3">
							<div class="mb-2 font-semibold">Tags:</div>
							<div class="text-sm whitespace-pre-wrap">
								{selectedSubmission.parsedData.game.tags}
							</div>
						</div>
					{/if}
					{#if selectedSubmission.parsedData.game.link}
						<div class="border-b border-base-300 pb-3">
							<div class="mb-2 font-semibold">Lien:</div>
							<div class="text-sm break-all">{selectedSubmission.parsedData.game.link}</div>
						</div>
					{/if}
					<div class="border-b border-base-300 pb-3">
						<div class="mb-2 font-semibold">Image:</div>
						<div class="text-sm break-all">{selectedSubmission.parsedData.game.image}</div>
					</div>
				</div>
			{:else if selectedSubmission.type === 'translation' && selectedSubmission.parsedData?.translation}
				{#if selectedSubmission.currentTranslation}
					<div class="space-y-4">
						{#if selectedSubmission.parsedData.translation.translationName !== selectedSubmission.currentTranslation.translationName}
							<div class="border-b border-base-300 pb-3">
								<div class="mb-2 font-semibold">Nom de traduction:</div>
								<div class="space-y-1">
									<div class="text-sm text-error line-through">
										{selectedSubmission.currentTranslation.translationName || '(vide)'}
									</div>
									<div class="font-medium text-success">
										{selectedSubmission.parsedData.translation.translationName || '(vide)'}
									</div>
								</div>
							</div>
						{/if}
						{#if selectedSubmission.parsedData.translation.version !== selectedSubmission.currentTranslation.version}
							<div class="border-b border-base-300 pb-3">
								<div class="mb-2 font-semibold">Version:</div>
								<div class="space-y-1">
									<div class="text-error line-through">
										{selectedSubmission.currentTranslation.version}
									</div>
									<div class="font-medium text-success">
										{selectedSubmission.parsedData.translation.version}
									</div>
								</div>
							</div>
						{/if}
						{#if selectedSubmission.parsedData.translation.tversion !== selectedSubmission.currentTranslation.tversion}
							<div class="border-b border-base-300 pb-3">
								<div class="mb-2 font-semibold">Version traduction:</div>
								<div class="space-y-1">
									<div class="text-error line-through">
										{selectedSubmission.currentTranslation.tversion}
									</div>
									<div class="font-medium text-success">
										{selectedSubmission.parsedData.translation.tversion}
									</div>
								</div>
							</div>
						{/if}
						{#if selectedSubmission.parsedData.translation.status !== selectedSubmission.currentTranslation.status}
							<div class="border-b border-base-300 pb-3">
								<div class="mb-2 font-semibold">Statut:</div>
								<div class="space-y-1">
									<div class="text-error line-through">
										{selectedSubmission.currentTranslation.status}
									</div>
									<div class="font-medium text-success">
										{selectedSubmission.parsedData.translation.status}
									</div>
								</div>
							</div>
						{/if}
						{#if selectedSubmission.parsedData.translation.ttype !== selectedSubmission.currentTranslation.ttype}
							<div class="border-b border-base-300 pb-3">
								<div class="mb-2 font-semibold">Type de traduction:</div>
								<div class="space-y-1">
									<div class="text-error line-through">
										{selectedSubmission.currentTranslation.ttype}
									</div>
									<div class="font-medium text-success">
										{selectedSubmission.parsedData.translation.ttype}
									</div>
								</div>
							</div>
						{/if}
						{#if selectedSubmission.parsedData.translation.tlink !== selectedSubmission.currentTranslation.tlink}
							<div class="border-b border-base-300 pb-3">
								<div class="mb-2 font-semibold">Lien:</div>
								<div class="space-y-1">
									<div class="text-sm break-all text-error line-through">
										{selectedSubmission.currentTranslation.tlink}
									</div>
									<div class="text-sm break-all text-success">
										{selectedSubmission.parsedData.translation.tlink}
									</div>
								</div>
							</div>
						{/if}
					</div>
				{:else}
					<div class="space-y-4">
						{#if selectedSubmission.parsedData.translation.translationName}
							<div class="border-b border-base-300 pb-3">
								<div class="mb-2 font-semibold">Nom de traduction:</div>
								<div>{selectedSubmission.parsedData.translation.translationName}</div>
							</div>
						{/if}
						<div class="border-b border-base-300 pb-3">
							<div class="mb-2 font-semibold">Version:</div>
							<div>{selectedSubmission.parsedData.translation.version}</div>
						</div>
						<div class="border-b border-base-300 pb-3">
							<div class="mb-2 font-semibold">Version traduction:</div>
							<div>{selectedSubmission.parsedData.translation.tversion}</div>
						</div>
						<div class="border-b border-base-300 pb-3">
							<div class="mb-2 font-semibold">Statut:</div>
							<div>{selectedSubmission.parsedData.translation.status}</div>
						</div>
						<div class="border-b border-base-300 pb-3">
							<div class="mb-2 font-semibold">Type de traduction:</div>
							<div>{selectedSubmission.parsedData.translation.ttype}</div>
						</div>
						<div class="border-b border-base-300 pb-3">
							<div class="mb-2 font-semibold">Lien:</div>
							<div class="text-sm break-all">{selectedSubmission.parsedData.translation.tlink}</div>
						</div>
					</div>
				{/if}
			{/if}

			<div class="modal-action">
				<button type="button" class="btn" onclick={closeChangesModal}> Fermer </button>
			</div>
		</div>
		<button
			type="button"
			class="modal-backdrop"
			onclick={closeChangesModal}
			aria-label="Fermer la modal"
		></button>
	</div>
{/if}
