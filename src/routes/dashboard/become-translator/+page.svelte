<script lang="ts">
	import { enhance } from '$app/forms';
	import { createFormEnhance } from '$lib/forms/enhance';
	import { untrack } from 'svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	let errorMessage = $state<string | null>(null);
	let successMessage = $state<string | null>(null);

	let explanation = $state('');
	let translatorName = $state(untrack(() => data.username ?? ''));

	type TranslatorOption = { id: string; name: string };
	let claimQuery = $state('');
	let claimResults = $state<TranslatorOption[]>([]);
	let claimSelected = $state<TranslatorOption | null>(null);
	let claimSearchTimeout: ReturnType<typeof setTimeout> | undefined;

	const onClaimQueryInput = () => {
		claimSelected = null;
		clearTimeout(claimSearchTimeout);
		const q = claimQuery.trim();
		if (!q) {
			claimResults = [];
			return;
		}
		claimSearchTimeout = setTimeout(async () => {
			const res = await fetch(
				`/dashboard/become-translator/search-translators?q=${encodeURIComponent(q)}`
			);
			if (!res.ok) return;
			const json = (await res.json()) as { translators: TranslatorOption[] };
			claimResults = json.translators;
		}, 250);
	};

	const selectClaim = (translator: TranslatorOption) => {
		claimSelected = translator;
		claimQuery = translator.name;
		claimResults = [];
	};

	const clearClaim = () => {
		claimSelected = null;
		claimQuery = '';
		claimResults = [];
	};

	const resetFormFields = () => {
		explanation = '';
		translatorName = data.username ?? '';
		clearClaim();
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
	<h1 class="text-2xl font-semibold">Devenir traducteur</h1>

	{#if errorMessage}
		<div class="alert alert-error"><span>{errorMessage}</span></div>
	{/if}
	{#if successMessage}
		<div class="alert alert-success"><span>{successMessage}</span></div>
	{/if}

	{#if data.alreadyLinked}
		<div class="alert alert-info">
			<span>Vous avez déjà un profil traducteur lié à ce compte.</span>
		</div>
	{:else if !data.hasDiscordLinked}
		<div class="alert alert-warning">
			<span>
				Vous devez lier votre compte Discord avant de postuler.
				<a href="/dashboard/settings" class="link font-semibold link-hover">
					Lier mon Discord dans les paramètres
				</a>
			</span>
		</div>
	{:else if data.application && data.application.status !== 'rejected'}
		{@const badge = statusBadge(data.application.status)}
		<div class="card w-full border border-base-300 bg-base-100 shadow-xl">
			<div class="card-body gap-4">
				<div class="flex items-center gap-2">
					<h2 class="text-lg font-semibold text-base-content">Votre candidature</h2>
					<div class="badge {badge.class}">{badge.label}</div>
				</div>
				{#if data.application.claimedTranslatorId}
					<p class="text-sm text-base-content/70">Profil traducteur existant revendiqué.</p>
				{:else if data.application.translatorName}
					<p class="text-sm text-base-content/70">
						<span class="font-semibold">Nom de traducteur :</span>
						{data.application.translatorName}
					</p>
				{/if}
				{#if data.application.explanation}
					<p class="text-sm whitespace-pre-wrap text-base-content/80">
						{data.application.explanation}
					</p>
				{/if}
				{#if data.application.status === 'rejected' && data.application.adminNotes}
					<div class="alert alert-warning">
						<span>Motif du refus : {data.application.adminNotes}</span>
					</div>
				{/if}
				{#if data.application.status === 'pending'}
					<form
						method="POST"
						action="?/cancel"
						use:enhance={createFormEnhance({
							onStart: () => {
								errorMessage = null;
								successMessage = null;
							},
							onFailure: (message) => {
								errorMessage = message;
							},
							onSuccess: () => {
								resetFormFields();
							},
							invalidateAll: true
						})}
					>
						<input type="hidden" name="applicationId" value={data.application.id} />
						<button type="submit" class="btn btn-outline btn-error btn-sm"
							>Annuler la candidature</button
						>
					</form>
				{/if}
			</div>
		</div>
	{:else}
		{#if data.application?.status === 'rejected'}
			<div class="alert alert-warning">
				<span>
					Votre précédente candidature a été refusée{#if data.application.adminNotes}
						: {data.application.adminNotes}{/if}. Vous pouvez soumettre une nouvelle candidature.
				</span>
			</div>
		{/if}
		<div class="card w-full border border-base-300 bg-base-100 shadow-xl">
			<div class="card-body gap-6">
				<p class="text-sm text-base-content/70">
					Un administrateur examinera votre candidature pour devenir traducteur.
				</p>
				<form
					method="POST"
					action="?/submit"
					class="flex flex-col gap-4"
					use:enhance={createFormEnhance({
						onStart: () => {
							errorMessage = null;
							successMessage = null;
						},
						onFailure: (message) => {
							errorMessage = message;
						},
						onSuccess: (result) => {
							const data = result.data as { message?: string } | undefined;
							successMessage = data?.message ?? 'Candidature envoyée';
						},
						invalidateAll: true
					})}
				>
					<div class="form-control w-full">
						<label class="label" for="claimedTranslator">
							<span class="label-text">Revendiquer un profil traducteur existant (optionnel)</span>
						</label>
						<div class="relative">
							<div class="flex gap-2">
								<input
									id="claimedTranslator"
									type="text"
									class="input-bordered input w-full"
									placeholder="Rechercher par nom…"
									autocomplete="off"
									bind:value={claimQuery}
									oninput={onClaimQueryInput}
								/>
								{#if claimSelected}
									<button type="button" class="btn btn-outline btn-sm" onclick={clearClaim}
										>Retirer</button
									>
								{/if}
							</div>
							{#if claimResults.length > 0}
								<ul
									class="menu absolute z-10 mt-1 w-full rounded-box border border-base-300 bg-base-100 shadow-lg"
								>
									{#each claimResults as translatorOption (translatorOption.id)}
										<li>
											<button type="button" onclick={() => selectClaim(translatorOption)}>
												{translatorOption.name}
											</button>
										</li>
									{/each}
								</ul>
							{/if}
						</div>
						<input type="hidden" name="claimedTranslatorId" value={claimSelected?.id ?? ''} />
						<span class="mt-1 text-xs text-base-content/60">
							Si un profil traducteur existant (legacy) correspond à votre pseudo, sélectionnez-le
							pour le lier à votre compte une fois la candidature acceptée.
						</span>
					</div>

					{#if !claimSelected}
						<div class="form-control w-full">
							<label class="label" for="translatorName">
								<span class="label-text">Nom de traducteur *</span>
							</label>
							<input
								id="translatorName"
								name="translatorName"
								type="text"
								class="input-bordered input w-full"
								bind:value={translatorName}
								required
							/>
							<span class="mt-1 text-xs text-base-content/60">
								Nom affiché sur vos futures traductions (par défaut, votre pseudo).
							</span>
						</div>
					{/if}

					<div class="form-control w-full">
						<label class="label" for="explanation">
							<span class="label-text">Explications (optionnel)</span>
						</label>
						<textarea
							id="explanation"
							name="explanation"
							class="textarea-bordered textarea w-full"
							rows="4"
							bind:value={explanation}></textarea>
					</div>

					<div class="flex justify-end">
						<button type="submit" class="btn btn-primary">Envoyer ma candidature</button>
					</div>
				</form>
			</div>
		</div>
	{/if}
</section>
