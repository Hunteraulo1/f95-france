<script lang="ts">
	import { enhance } from '$app/forms';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form?: ActionData } = $props();

	const newKey = $derived(
		form && typeof form === 'object' && 'createdKey' in form && typeof form.createdKey === 'string'
			? form.createdKey
			: null
	);
</script>

<svelte:head>
	<title>Mes clés API — F95 France</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4">
	<div class="flex items-center gap-2">
		<KeyRound class="size-8 text-primary" aria-hidden="true" />
		<h1 class="text-2xl font-semibold">Mes clés API</h1>
	</div>

	<p class="text-sm text-base-content/80">
		Toutes les routes sous
		<code class="rounded bg-base-200 px-1 py-0.5 text-sm">/api/</code>
		(sauf cron, passkeys, OAuth et la page doc) exigent une <strong>session</strong> (cookie) ou cette
		<strong>clé</strong> dans
		<code class="rounded bg-base-200 px-1 py-0.5 text-sm">Authorization: Bearer …</code>
		ou
		<code class="rounded bg-base-200 px-1 py-0.5 text-sm">X-Api-Key</code>. La clé agit comme ton compte pour ces appels. Tu peux avoir au plus
		<strong>{data.limits.maxKeys}</strong> clés actives ; chaque nouvelle clé a un quota de
		<strong>{data.limits.defaultRpm}</strong> requêtes par minute. Pour augmenter cette limite,
		<strong>contacte un administrateur</strong>.
	</p>

	<div class="alert alert-info sm:alert-horizontal">
		<span>
			Utilise l’API avec <strong>modération</strong> : un trafic excessif ou un usage abusif peut
			entraîner des restrictions (limitation de débit, révocation des clés, etc.).
		</span>
	</div>

	<p class="text-sm text-base-content/70">
		Clés actives : {data.activeCount} / {data.limits.maxKeys}
	</p>

	{#if newKey}
		<div role="alert" class="alert alert-warning">
			<div class="flex flex-col gap-2">
				<span class="font-medium">Copiez cette clé maintenant — elle ne sera plus affichée.</span>
				<code class="rounded bg-base-100 p-2 text-sm break-all text-base-content select-all">{newKey}</code>
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					onclick={() => navigator.clipboard.writeText(newKey)}
				>
					Copier
				</button>
			</div>
		</div>
	{/if}

	{#if form?.message}
		<div role="alert" class="alert alert-error">
			<span>{form.message}</span>
		</div>
	{/if}

	<div class="card bg-base-200">
		<div class="card-body gap-4">
			<h2 class="card-title text-lg">Nouvelle clé</h2>
			<form
				method="post"
				action="?/create"
				use:enhance={() => {
					return async ({ update }) => {
						await update();
					};
				}}
				class="flex flex-col gap-3"
			>
				<label class="flex flex-col gap-1">
					<span class="text-sm font-medium">Libellé</span>
					<input
						class="input-bordered input w-full max-w-md"
						name="label"
						placeholder="Extension navigateur, script…"
					/>
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-sm font-medium">Expiration (optionnel)</span>
					<input
						class="input-bordered input w-full max-w-xs"
						type="datetime-local"
						name="expiresAt"
					/>
				</label>
				<button
					type="submit"
					class="btn btn-primary w-fit"
					disabled={data.activeCount >= data.limits.maxKeys}
				>
					Générer une clé
				</button>
			</form>
		</div>
	</div>

	<div class="overflow-x-auto rounded-lg border border-base-300">
		<table class="table table-zebra">
			<thead>
				<tr>
					<th>Préfixe</th>
					<th>Libellé</th>
					<th>Quota / min</th>
					<th>Créée</th>
					<th>Expire</th>
					<th>Dernière utilisation</th>
					<th>État</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each data.keys as row (row.id)}
					<tr>
						<td><code class="text-sm">{row.keyPrefix}…</code></td>
						<td>{row.label || '—'}</td>
						<td>{row.requestsPerMinute}</td>
						<td
							>{new Intl.DateTimeFormat('fr-FR', {
								dateStyle: 'short',
								timeStyle: 'short'
							}).format(new Date(row.createdAt))}</td
						>
						<td>
							{#if row.expiresAt}
								{new Intl.DateTimeFormat('fr-FR', {
									dateStyle: 'short',
									timeStyle: 'short'
								}).format(new Date(row.expiresAt))}
							{:else}
								—
							{/if}
						</td>
						<td>
							{#if row.lastUsedAt}
								{new Intl.DateTimeFormat('fr-FR', {
									dateStyle: 'short',
									timeStyle: 'short'
								}).format(new Date(row.lastUsedAt))}
							{:else}
								—
							{/if}
						</td>
						<td>
							{#if row.revokedAt}
								<span class="badge badge-error">Révoquée</span>
							{:else if row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()}
								<span class="badge badge-warning">Expirée</span>
							{:else}
								<span class="badge badge-success">Active</span>
							{/if}
						</td>
						<td>
							{#if !row.revokedAt}
								<form method="post" action="?/revoke" use:enhance>
									<input type="hidden" name="id" value={row.id} />
									<button type="submit" class="btn btn-ghost btn-sm text-error">Révoquer</button>
								</form>
							{/if}
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan="8" class="text-base-content/70">Aucune clé pour le moment.</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
