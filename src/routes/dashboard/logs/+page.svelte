<script lang="ts">
	import DaisyDashboardModal from '$lib/components/dashboard/DaisyDashboardModal.svelte';
	import { roleBadgeStyles } from '$lib/stores';
	import { roleUsernameClass } from '$lib/utils/role-display';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let methodFilter = $state('');
	let search = $state('');
	let userSearch = $state('');
	let errorsOnly = $state(false);
	let warningsOnly = $state(false);
	let redirectsOnly = $state(false);
	let limit = $state('50');
	let showPayloadModal = $state(false);
	let formattedPayload = $state<string | null>(null);
	let payloadFormat = $state<'json' | 'texte'>('texte');
	let showErrorModal = $state(false);
	let errorMessage = $state<string | null>(null);
	let filtersInitialized = $state(false);

	$effect(() => {
		if (filtersInitialized) return;
		methodFilter = data.filters.method ?? '';
		search = data.filters.search ?? '';
		userSearch = data.filters.user ?? '';
		errorsOnly = data.filters.errorsOnly ?? false;
		warningsOnly = data.filters.warningsOnly ?? false;
		redirectsOnly = data.filters.redirectsOnly ?? false;
		limit = String(data.filters.limit);
		filtersInitialized = true;
	});

	const methodOptions = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

	const formatDate = (value: string | Date) => {
		const date = value instanceof Date ? value : new Date(value);
		return new Intl.DateTimeFormat('fr-FR', {
			dateStyle: 'short',
			timeStyle: 'medium'
		}).format(date);
	};

	const methodBadge = (method: string) => {
		switch (method) {
			case 'GET':
				return 'badge-success';
			case 'POST':
				return 'badge-primary';
			case 'PUT':
				return 'badge-warning';
			case 'DELETE':
				return 'badge-error';
			case 'PATCH':
				return 'badge-info';
			default:
				return 'badge-neutral';
		}
	};

	const statusBadge = (status: number) => {
		if (status >= 500) return 'badge-error';
		if (status >= 400) return 'badge-warning';
		if (status >= 200) return 'badge-success';
		return 'badge-neutral';
	};

	const openPayloadModal = (payload: string) => {
		try {
			const parsed = JSON.parse(payload);
			formattedPayload = JSON.stringify(parsed, null, 2);
			payloadFormat = 'json';
		} catch {
			formattedPayload = payload;
			payloadFormat = 'texte';
		}
		showPayloadModal = true;
	};

	const closePayloadModal = () => {
		showPayloadModal = false;
		formattedPayload = null;
	};

	const openErrorModal = (errorMsg: string) => {
		errorMessage = errorMsg;
		showErrorModal = true;
	};

	const closeErrorModal = () => {
		showErrorModal = false;
		errorMessage = null;
	};
</script>

<svelte:head>
	<title>Logs des requêtes - Tableau de bord</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex flex-wrap items-center justify-between gap-4">
		<div>
			<h1 class="text-3xl font-bold text-base-content">Logs des requêtes</h1>
			<p class="text-base-content/70">
				Historique des routes API, du tableau de bord et de la maintenance (hors polling
				notifications et appels extension-api).
			</p>
		</div>
	</div>

	<form method="GET" class="card w-full border border-base-300 bg-base-100 shadow-xl">
		<div class="card-body gap-6 sm:p-8">
			<div class="grid grid-cols-1 gap-4 xs:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
				<label class="form-control flex flex-col">
					<span class="label-text">Méthode</span>
					<select class="select-bordered select" name="method" bind:value={methodFilter}>
						<option value="">Toutes</option>
						{#each methodOptions as option (option)}
							<option value={option}>{option}</option>
						{/each}
					</select>
				</label>
				<label class="form-control flex flex-col">
					<span class="label-text">Recherche <span class="text-sm">(route ou payload)</span></span>
					<input
						type="text"
						name="q"
						class="input-bordered input"
						placeholder="/api/..."
						bind:value={search}
					/>
				</label>
				<label class="form-control flex flex-col">
					<span class="label-text">Utilisateur</span>
					<input
						type="text"
						name="user"
						class="input-bordered input"
						placeholder="Nom d'utilisateur..."
						bind:value={userSearch}
					/>
				</label>
				<label class="form-control flex flex-col">
					<span class="label-text">Filtres de statut</span>
					<div class="m-2 mb-0 flex flex-col space-y-2">
						<label class="label cursor-pointer">
							<input
								type="checkbox"
								class="checkbox checkbox-info"
								checked={redirectsOnly}
								onchange={(e) => {
									redirectsOnly = e.currentTarget.checked;
									if (redirectsOnly) {
										errorsOnly = false;
										warningsOnly = false;
									}
								}}
							/>
							<span class="label-text">Redirections (3xx)</span>
						</label>
						<label class="label cursor-pointer">
							<input
								type="checkbox"
								class="checkbox checkbox-warning"
								checked={warningsOnly}
								onchange={(e) => {
									warningsOnly = e.currentTarget.checked;
									if (warningsOnly) {
										errorsOnly = false;
										redirectsOnly = false;
									}
								}}
							/>
							<span class="label-text">Warnings (4xx)</span>
						</label>
						<label class="label cursor-pointer">
							<input
								type="checkbox"
								class="checkbox checkbox-error"
								checked={errorsOnly}
								onchange={(e) => {
									errorsOnly = e.currentTarget.checked;
									if (errorsOnly) {
										warningsOnly = false;
										redirectsOnly = false;
									}
								}}
							/>
							<span class="label-text">Erreurs (5xx)</span>
						</label>
					</div>
					{#if redirectsOnly}
						<input type="hidden" name="redirects" value="true" />
					{/if}
					{#if warningsOnly}
						<input type="hidden" name="warnings" value="true" />
					{/if}
					{#if errorsOnly}
						<input type="hidden" name="errors" value="true" />
					{/if}
				</label>
			</div>
			<label class="form-control flex flex-col">
				<span class="label-text">Limite</span>
				<select class="select-bordered select" name="limit" bind:value={limit}>
					{#each [25, 50, 100, 200, 500] as option (option)}
						<option value={option}>{option} lignes</option>
					{/each}
				</select>
			</label>
			<div class="flex justify-end gap-2 md:col-span-6">
				<a href="/dashboard/logs" class="btn btn-ghost">Réinitialiser</a>
				<button type="submit" class="btn btn-primary">Actualiser</button>
			</div>
		</div>
	</form>

	<div class="card w-full border border-base-300 bg-base-100 shadow-xl">
		<div class="card-body gap-6 sm:py-8">
			<div class="overflow-x-auto">
				<table class="table table-zebra">
					<thead>
						<tr>
							<th>Date</th>
							<th>Méthode</th>
							<th>Route</th>
							<th>Statut</th>
							<th>Utilisateur</th>
							<th>Payload</th>
							<th>Erreur</th>
						</tr>
					</thead>
					<tbody>
						{#if data.logs.length === 0}
							<tr>
								<td colspan="8" class="py-10 text-center text-base-content/60">
									Aucun log disponible pour ces critères.
								</td>
							</tr>
						{:else}
							{#each data.logs as log (log.id)}
								<tr>
									<td class="whitespace-nowrap">{formatDate(log.createdAt)}</td>
									<td>
										<span class={`badge ${methodBadge(log.method)}`}>{log.method}</span>
									</td>
									<td class="font-mono text-sm">{log.route}</td>
									<td>
										<span class={`badge ${statusBadge(log.status)}`}>{log.status}</span>
									</td>
									<td>
										{#if log.user?.username}
											<span
												class="font-semibold {roleUsernameClass(
													log.user.role,
													$roleBadgeStyles[log.user.role]
												)}">{log.user.username}</span
											>
										{:else}
											<span class="text-base-content/60">Anonyme</span>
										{/if}
									</td>
									<td class="max-w-xs">
										{#if log.payload}
											<button
												type="button"
												class="btn text-primary btn-ghost btn-xs"
												onclick={() => openPayloadModal(log.payload ?? '')}
											>
												Voir
											</button>
										{:else}
											<span class="text-base-content/60">—</span>
										{/if}
									</td>
									<td class="max-w-xs">
										{#if 'errorMessage' in log && log.errorMessage}
											<button
												type="button"
												class="btn text-error btn-ghost btn-xs"
												onclick={() =>
													openErrorModal(
														typeof log.errorMessage === 'string' ? log.errorMessage : ''
													)}
											>
												Voir
											</button>
										{:else}
											<span class="text-base-content/60">—</span>
										{/if}
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	</div>
</div>

<DaisyDashboardModal
	open={showPayloadModal && formattedPayload !== null}
	title="Payload de la requête"
	description="Aperçu brut limité à 4000 caractères."
	maxWidthClass="max-w-4xl"
	scrollBody={true}
	onClose={closePayloadModal}
>
	{#if formattedPayload}
		<span class={`badge ${payloadFormat === 'json' ? 'badge-success' : 'badge-neutral'}`}>
			{payloadFormat === 'json' ? 'JSON' : 'Texte'}
		</span>
		<pre class="mt-4 max-h-[60vh] overflow-auto rounded-lg bg-base-200 p-4 text-left text-xs">
{formattedPayload}
</pre>
	{/if}
	{#snippet footer()}
		<button type="button" class="btn btn-primary" onclick={closePayloadModal}>Fermer</button>
	{/snippet}
</DaisyDashboardModal>

<DaisyDashboardModal
	open={showErrorModal && errorMessage !== null}
	title="Détails de l'erreur"
	description="Message d'erreur et stack trace."
	maxWidthClass="max-w-4xl"
	scrollBody={true}
	onClose={closeErrorModal}
>
	{#if errorMessage}
		<span class="badge badge-error">Erreur</span>
		<pre
			class="mt-4 max-h-[60vh] overflow-auto rounded-lg bg-base-200 p-4 text-left text-xs whitespace-pre-wrap">
{errorMessage}
</pre>
	{/if}
	{#snippet footer()}
		<button type="button" class="btn btn-primary" onclick={closeErrorModal}>Fermer</button>
	{/snippet}
</DaisyDashboardModal>
