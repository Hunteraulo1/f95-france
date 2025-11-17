<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let methodFilter = $state(data.filters.method ?? '');
	let search = $state(data.filters.search ?? '');
	let limit = $state(String(data.filters.limit));
	let showPayloadModal = $state(false);
	let formattedPayload = $state<string | null>(null);
	let payloadFormat = $state<'json' | 'texte'>('texte');

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
</script>

<svelte:head>
	<title>Logs API - Tableau de bord</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex flex-wrap items-center justify-between gap-4">
		<div>
			<h1 class="text-3xl font-bold text-base-content">Logs de l'API</h1>
			<p class="text-base-content/70">Historique des appels effectués vers les routes /api.</p>
		</div>
	</div>

	<form method="GET" class="grid gap-4 rounded-lg border border-base-300 p-4 md:grid-cols-4">
		<label class="form-control">
			<span class="label-text">Méthode</span>
			<select class="select-bordered select" name="method" bind:value={methodFilter}>
				<option value="">Toutes</option>
				{#each methodOptions as option (option)}
					<option value={option}>{option}</option>
				{/each}
			</select>
		</label>

		<label class="form-control">
			<span class="label-text">Recherche (route ou payload)</span>
			<input
				type="text"
				name="q"
				class="input-bordered input"
				placeholder="/api/..."
				bind:value={search}
			/>
		</label>

		<label class="form-control">
			<span class="label-text">Limite</span>
			<select class="select-bordered select" name="limit" bind:value={limit}>
				{#each [25, 50, 100, 200, 500] as option (option)}
					<option value={option}>{option} lignes</option>
				{/each}
			</select>
		</label>

		<div class="flex justify-end gap-2 md:col-span-4">
			<a href="/dashboard/logs" class="btn btn-ghost">Réinitialiser</a>
			<button type="submit" class="btn btn-primary">Actualiser</button>
		</div>
	</form>

	<div class="card bg-base-100 shadow-xl">
		<div class="card-body p-0">
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
						</tr>
					</thead>
					<tbody>
						{#if data.logs.length === 0}
							<tr>
								<td colspan="7" class="py-10 text-center text-base-content/60">
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
											<span class="font-semibold">{log.user.username}</span>
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
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	</div>
</div>

{#if showPayloadModal && formattedPayload}
	<div class="modal-open modal">
		<div class="modal-box max-w-4xl">
			<div class="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h3 class="text-lg font-bold">Payload de la requête</h3>
					<p class="text-sm text-base-content/60">Aperçu brut limité à 4000 caractères.</p>
				</div>
				<span class={`badge ${payloadFormat === 'json' ? 'badge-success' : 'badge-neutral'}`}>
					{payloadFormat === 'json' ? 'JSON' : 'Texte'}
				</span>
			</div>
			<pre class="mt-4 max-h-[60vh] overflow-auto rounded-lg bg-base-200 p-4 text-left text-xs">
{formattedPayload}
</pre>
			<div class="modal-action">
				<button type="button" class="btn btn-primary" onclick={closePayloadModal}>Fermer</button>
			</div>
		</div>
		<button class="modal-backdrop" onclick={closePayloadModal}> Fermer </button>
	</div>
{/if}
