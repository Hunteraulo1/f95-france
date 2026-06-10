<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { API_KEY_EXTENSION_ONLY_LABEL_TOKEN } from '$lib/api-keys/label-tokens';
	import { createFormEnhance } from '$lib/forms/enhance';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form?: ActionData } = $props();

	const newKey = $derived(
		form && typeof form === 'object' && 'createdKey' in form && typeof form.createdKey === 'string'
			? form.createdKey
			: null
	);
	let showNewKey = $state(false);
	const maskedNewKey = $derived(
		newKey ? `${'•'.repeat(Math.max(8, newKey.length - 4))}${newKey.slice(-4)}` : ''
	);

	const buildQuery = (overrides: { revoked?: string } = {}) => {
		const revoked = overrides.revoked ?? data.revokedFilter;
		const params =
			revoked && revoked !== 'not_revoked' ? [`revoked=${encodeURIComponent(revoked)}`] : [];
		return params.length ? `?${params.join('&')}` : '';
	};

	const buildHref = (overrides: { revoked?: string } = {}) =>
		resolve(`/dashboard/api-keys${buildQuery(overrides)}` as '/dashboard/api-keys');

	const formatCount = (n: number) => new Intl.NumberFormat('fr-FR').format(n);

	const revokedOptions = [
		{ value: 'all', label: 'Toutes' },
		{ value: 'revoked', label: 'Révoquées' },
		{ value: 'not_revoked', label: 'Non révoquées' }
	] as const;
</script>

<svelte:head>
	<title>Mes clés API — F95 France</title>
</svelte:head>

<div class="flex w-full flex-col gap-6">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div class="flex items-center gap-2">
			<KeyRound class="size-8 text-primary" aria-hidden="true" />
			<h1 class="text-2xl font-semibold">Mes clés API</h1>
		</div>
		<a href="https://api.f95france.site" class="btn gap-2 btn-outline btn-sm">
			<BookOpen class="size-4 shrink-0" aria-hidden="true" />
			Documentation API
		</a>
	</div>

	<p class="text-sm text-base-content/80">
		Pour appeler l’API sous
		<code class="rounded bg-base-200 px-1 py-0.5 text-sm">/api/</code>
		, envoie ta <strong>clé</strong> dans
		<code class="rounded bg-base-200 px-1 py-0.5 text-sm">Authorization: Bearer …</code>
		ou
		<code class="rounded bg-base-200 px-1 py-0.5 text-sm">X-Api-Key</code>. La clé agit comme ton
		compte pour ces appels. Tu peux avoir au plus
		<strong>{data.limits.maxKeys}</strong> clés actives ; chaque nouvelle clé a un quota de
		<strong>{data.limits.defaultRpm}</strong> requêtes par minute. Pour augmenter cette limite,
		<strong>contacte un administrateur</strong>.
	</p>

	<div class="alert alert-info sm:alert-horizontal">
		<span>
			Utilise l’API avec <strong>modération</strong> : un trafic excessif ou un usage abusif peut entraîner
			des restrictions (limitation de débit, révocation des clés, etc.).
		</span>
	</div>

	<p class="text-sm text-base-content/70">
		Clés API actives : {data.activeCount} / {data.limits.maxKeys}
	</p>

	{#if newKey}
		<div role="alert" class="alert alert-warning">
			<div class="flex flex-col gap-2">
				<span class="font-medium">Copiez cette clé maintenant — elle ne sera plus affichée.</span>
				<code class="rounded bg-base-100 p-2 text-sm break-all text-base-content select-all"
					>{showNewKey ? newKey : maskedNewKey}</code
				>
				<div class="flex flex-wrap items-center gap-2">
					<button
						type="button"
						class="btn btn-ghost btn-sm"
						onclick={() => (showNewKey = !showNewKey)}
					>
						{showNewKey ? 'Masquer' : 'Afficher'}
					</button>
					<button
						type="button"
						class="btn btn-ghost btn-sm"
						onclick={() => navigator.clipboard.writeText(newKey)}
					>
						Copier
					</button>
				</div>
			</div>
		</div>
	{/if}

	{#if form?.message}
		<div role="alert" class="alert alert-error">
			<span>{form.message}</span>
		</div>
	{/if}

	<div class="card w-full border border-base-300 bg-base-100 shadow-xl">
		<div class="card-body gap-6 sm:p-8">
			<h2 class="card-title text-lg">Nouvelle clé</h2>
			<form
				method="post"
				action="?/create"
				use:enhance={createFormEnhance()}
				class="flex flex-col gap-3"
			>
				<label class="flex flex-col gap-1">
					<span class="text-sm font-medium">Libellé</span>
					<input
						class="input-bordered input w-full max-w-md"
						name="label"
						placeholder="Extension navigateur, script…"
					/>
					{#if data.canUseLabelBrackets}
						<p class="text-xs text-base-content/70">
							Tu peux utiliser des crochets, par ex.
							<code class="rounded bg-base-200 px-1 py-0.5"
								>{API_KEY_EXTENSION_ONLY_LABEL_TOKEN}</code
							>
							pour limiter la clé à l’extension.
						</p>
					{:else}
						<p class="text-xs text-base-content/70">
							Les crochets [ ] dans le libellé sont réservés — contacte un administrateur si tu en
							as besoin.
						</p>
					{/if}
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
					class="btn w-fit btn-primary"
					disabled={data.activeCount >= data.limits.maxKeys}
				>
					Générer une clé
				</button>
			</form>
		</div>
	</div>

	<div class="join ml-auto w-fit rounded-sm border border-base-300 bg-base-100">
		{#each revokedOptions as option (option.value)}
			<a
				class="btn join-item text-nowrap btn-sm {data.revokedFilter === option.value
					? 'bg-base-300 btn-outline btn-primary'
					: 'btn-ghost'}"
				href={buildHref({ revoked: option.value })}
			>
				{option.label}
			</a>
		{/each}
	</div>

	<div class="card w-full overflow-x-auto rounded-lg border border-base-300 bg-base-100 shadow-xl">
		<table class="table card-body gap-6 table-zebra sm:py-8">
			<thead>
				<tr>
					<th>Préfixe</th>
					<th>Libellé</th>
					<th>Quota / min</th>
					<th>Utilisations (total)</th>
					<th>Créée</th>
					<th>Expire</th>
					<th>Dernière utilisation</th>
					<th>État</th>
					<th>Actions</th>
				</tr>
			</thead>
			<tbody>
				{#each data.keys as row (row.id)}
					<tr>
						<td><code class="text-sm">{row.keyPrefix}…</code></td>
						<td>{row.label || '—'}</td>
						<td>{row.requestsPerMinute}</td>
						<td class="tabular-nums">{formatCount(row.totalRequestCount)}</td>
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
						<td class="min-w-48">
							{#if !row.revokedAt}
								<div class="flex items-center gap-2">
									<form
										method="post"
										action="?/rotate"
										use:enhance={createFormEnhance({ invalidateAll: true })}
									>
										<input type="hidden" name="id" value={row.id} />
										<button type="submit" class="btn btn-outline btn-sm">Régénérer</button>
									</form>
									<form
										method="post"
										action="?/revoke"
										use:enhance={createFormEnhance({ invalidateAll: true })}
									>
										<input type="hidden" name="id" value={row.id} />
										<button type="submit" class="btn text-error btn-ghost btn-sm">Révoquer</button>
									</form>
								</div>
							{/if}
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan="9" class="text-base-content/70">Aucune clé API générée pour le moment.</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
