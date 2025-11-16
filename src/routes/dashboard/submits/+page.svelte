<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { CircleCheck, CircleX, Clock } from '@lucide/svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let showStatusModal = $state(false);
	let selectedSubmission: (typeof data.submissions)[0] | null = $state(null);
	let statusError = $state<string | null>(null);

	const openStatusModal = (submission: (typeof data.submissions)[0]) => {
		selectedSubmission = submission;
		showStatusModal = true;
		statusError = null;
	};

	const closeStatusModal = () => {
		showStatusModal = false;
		selectedSubmission = null;
		statusError = null;
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
			default:
				return type;
		}
	};

	const updateFilter = (status: string) => {
		goto(`/dashboard/submits?status=${status}`, { noScroll: true });
	};
</script>

<section class="flex flex-col gap-4">
	<div class="flex items-center justify-between">
		<h2 class="text-lg font-semibold text-slate-900 dark:text-slate-200">
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
				<div class="badge badge-primary badge-sm ml-2">{data.pendingCount}</div>
			{/if}
		</button>
		<button
			class="btn btn-sm"
			class:btn-active={data.statusFilter === 'accepted'}
			onclick={() => updateFilter('accepted')}
		>
			Acceptées
			{#if data.acceptedCount > 0}
				<div class="badge badge-success badge-sm ml-2">{data.acceptedCount}</div>
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
		<div class="card bg-base-100 shadow-sm p-8">
			<div class="text-center">
				<p class="text-lg opacity-70">Aucune soumission {data.statusFilter === 'pending' ? 'en attente' : data.statusFilter === 'accepted' ? 'acceptée' : data.statusFilter === 'rejected' ? 'refusée' : ''}</p>
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
								<div class="flex items-center gap-3 mb-2">
									<h3 class="card-title text-lg">{submission.title}</h3>
									<div class="badge {statusBadge.class} gap-1">
										<StatusIcon size={14} />
										{statusBadge.label}
									</div>
									<div class="badge badge-outline">
										{getTypeLabel(submission.type)}
									</div>
								</div>

								{#if submission.user}
									<div class="flex items-center gap-2 mb-2">
										<div class="avatar">
											<div class="mask mask-squircle w-8 h-8">
												<img src={submission.user.avatar} alt={submission.user.username} />
											</div>
										</div>
										<span class="text-sm opacity-70">{submission.user.username}</span>
									</div>
								{/if}
								
								{#if submission.description}
									<p class="text-sm opacity-70 mb-2 line-clamp-2">
										{submission.description}
									</p>
								{/if}

								{#if submission.game}
									<div class="flex items-center gap-2 mt-2">
										{#if submission.game.image}
											<img
												src={submission.game.image}
												alt={submission.game.name}
												class="w-10 h-10 rounded object-cover"
											/>
										{/if}
										<span class="text-sm opacity-70">{submission.game.name}</span>
									</div>
								{/if}

								{#if submission.adminNotes}
									<div class="alert alert-info mt-2">
										<span class="text-sm">
											<strong>Notes admin:</strong> {submission.adminNotes}
										</span>
									</div>
								{/if}

								<div class="text-xs opacity-50 mt-2">
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
								<button
									class="btn btn-primary btn-sm"
									onclick={() => openStatusModal(submission)}
								>
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
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="font-bold text-lg">Modifier le statut de la soumission</h3>

			{#if statusError}
				<div class="alert alert-error mt-4">
					<span>{statusError}</span>
				</div>
			{/if}

			<form method="POST" action="?/updateStatus" use:enhance={() => {
				statusError = null;
				return async ({ result, update }) => {
					if (result.type === 'success') {
						await update();
						closeStatusModal();
					} else if (result.type === 'failure' && result.data) {
						const message = typeof result.data === 'object' && 'message' in result.data 
							? String(result.data.message) 
							: 'Erreur lors de la mise à jour';
						statusError = message;
					}
				};
			}}>
				<input type="hidden" name="submissionId" value={selectedSubmission.id} />

				<div class="form-control w-full mt-4">
					<label for="status" class="label">
						<span class="label-text">Statut</span>
					</label>
					<select
						id="status"
						name="status"
						class="select select-bordered w-full"
						class:select-error={statusError}
						value={selectedSubmission.status}
						required
					>
						<option value="pending">En attente</option>
						<option value="accepted">Acceptée</option>
						<option value="rejected">Refusée</option>
					</select>
				</div>

				<div class="form-control w-full mt-4">
					<label for="adminNotes" class="label">
						<span class="label-text">Notes admin (optionnel)</span>
					</label>
					<textarea
						id="adminNotes"
						name="adminNotes"
						class="textarea textarea-bordered w-full"
						placeholder="Ajouter des notes pour cette soumission..."
						rows="4"
					>{selectedSubmission.adminNotes || ''}</textarea>
				</div>

				<div class="modal-action">
					<button type="button" class="btn" onclick={closeStatusModal}>
						Annuler
					</button>
					<button type="submit" class="btn btn-primary">
						Enregistrer
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
