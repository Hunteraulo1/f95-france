<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createFormEnhance } from '$lib/forms/enhance';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	let errorMessage = $state<string | null>(null);
	let successMessage = $state<string | null>(null);
	let notesByApplication = $state<Record<string, string>>({});

	const tabs: { value: string; label: string }[] = [
		{ value: 'pending', label: 'En attente' },
		{ value: 'accepted', label: 'Acceptées' },
		{ value: 'rejected', label: 'Refusées' },
		{ value: 'all', label: 'Toutes' }
	];

	const switchTab = (status: string) => {
		goto(
			resolve(
				`/dashboard/translator-applications?status=${status}` as '/dashboard/translator-applications'
			)
		);
	};

	const statusBadge = (status: string) => {
		switch (status) {
			case 'pending':
				return { label: 'En attente', class: 'badge-warning' };
			case 'accepted':
				return { label: 'Acceptée', class: 'badge-success' };
			case 'rejected':
				return { label: 'Refusée', class: 'badge-error' };
			default:
				return { label: status, class: 'badge-neutral' };
		}
	};
</script>

<section class="flex flex-col gap-6">
	<h1 class="text-2xl font-semibold">Candidatures traducteur</h1>

	{#if errorMessage}
		<div class="alert alert-error"><span>{errorMessage}</span></div>
	{/if}
	{#if successMessage}
		<div class="alert alert-success"><span>{successMessage}</span></div>
	{/if}

	<div class="tabs-boxed tabs w-fit">
		{#each tabs as tab (tab.value)}
			<button
				type="button"
				class="tab"
				class:tab-active={data.statusFilter === tab.value}
				onclick={() => switchTab(tab.value)}
			>
				{tab.label}
			</button>
		{/each}
	</div>

	{#if data.applications.length === 0}
		<p class="text-sm text-base-content/60">Aucune candidature.</p>
	{/if}

	<div class="flex flex-col gap-4">
		{#each data.applications as application (application.id)}
			{@const badge = statusBadge(application.status)}
			<div class="card w-full border border-base-300 bg-base-100 shadow-xl">
				<div class="card-body gap-3">
					<div class="flex flex-wrap items-center gap-2">
						<span class="font-semibold"
							>{application.applicant?.username ?? 'Utilisateur inconnu'}</span
						>
						<div class="badge {badge.class}">{badge.label}</div>
						{#if application.claimedTranslator}
							<a
								href="/dashboard/translators?q={encodeURIComponent(
									application.claimedTranslator.name
								)}"
								class="badge badge-outline"
							>
								Revendique : {application.claimedTranslator.name}
							</a>
						{:else if application.translatorName}
							<div class="badge badge-outline">Nouveau profil : {application.translatorName}</div>
						{/if}
					</div>

					{#if application.explanation}
						<p class="text-sm whitespace-pre-wrap text-base-content/80">
							{application.explanation}
						</p>
					{/if}
					{#if application.adminNotes}
						<p class="text-sm text-base-content/70">
							<span class="font-semibold">Notes admin :</span>
							{application.adminNotes}
						</p>
					{/if}

					{#if application.status === 'pending'}
						<form
							method="POST"
							action="?/updateStatus"
							class="flex flex-col gap-2"
							use:enhance={createFormEnhance({
								onStart: () => {
									errorMessage = null;
									successMessage = null;
								},
								onFailure: (message) => {
									errorMessage = message;
								},
								onSuccess: (result) => {
									const resultData = result.data as { message?: string } | undefined;
									successMessage = resultData?.message ?? 'Candidature mise à jour';
								},
								invalidateAll: true
							})}
						>
							<input type="hidden" name="applicationId" value={application.id} />
							<textarea
								name="adminNotes"
								class="textarea-bordered textarea w-full"
								rows="2"
								placeholder="Notes admin (obligatoire en cas de refus)"
								bind:value={notesByApplication[application.id]}></textarea>
							<div class="flex justify-end gap-2">
								<button
									type="submit"
									name="status"
									value="rejected"
									class="btn btn-outline btn-error btn-sm"
								>
									Refuser
								</button>
								<button type="submit" name="status" value="accepted" class="btn btn-sm btn-success">
									Accepter
								</button>
							</div>
						</form>
					{/if}
				</div>
			</div>
		{/each}
	</div>
</section>
