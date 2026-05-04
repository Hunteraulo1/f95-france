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

	const formatDt = (v: Date | string | null) => {
		if (!v) return '—';
		return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(
			new Date(v)
		);
	};

	/** Valeur datetime-local pour input (expiration actuelle ou vide). */
	const toLocalInput = (v: Date | string | null) => {
		if (!v) return '';
		const d = new Date(v);
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	};

	const formatCount = (n: number) => new Intl.NumberFormat('fr-FR').format(n);
</script>

<svelte:head>
	<title>Gestion API — F95 France</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4">
	<div class="flex items-center gap-2">
		<KeyRound class="size-8 text-primary" aria-hidden="true" />
		<h1 class="text-2xl font-semibold">Gestion des clés API</h1>
	</div>

	<p class="text-sm text-base-content/80">
		Gestion de toutes les clés : création pour un utilisateur, révocation, modification du quota et
		de l’expiration.
	</p>

	{#if newKey}
		<div role="alert" class="alert alert-warning">
			<div class="flex flex-col gap-2">
				<span class="font-medium">Nouvelle clé — à copier tout de suite.</span>
				<code class="rounded bg-base-100 p-2 text-sm break-all text-base-content select-all"
					>{newKey}</code
				>
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

	{#if form && 'updated' in form && form.updated}
		<div role="alert" class="alert alert-success">
			<span>Quota / expiration mis à jour.</span>
		</div>
	{/if}

	<div class="card bg-base-200">
		<div class="card-body gap-4">
			<h2 class="card-title text-lg">Créer une clé pour un utilisateur</h2>
			<form method="post" action="?/create" use:enhance class="flex flex-col gap-3">
				<label class="flex max-w-md flex-col gap-1">
					<span class="text-sm font-medium">Propriétaire</span>
					<select class="select-bordered select w-full" name="ownerUserId" required>
						<option value="" disabled selected>Choisir un compte</option>
						{#each data.usersList as u (u.id)}
							<option value={u.id}>{u.username} — {u.email}</option>
						{/each}
					</select>
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-sm font-medium">Libellé</span>
					<input class="input-bordered input w-full max-w-md" name="label" placeholder="Clé API" />
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-sm font-medium">Requêtes max / minute (0-10000)</span>
					<input
						class="input-bordered input w-full max-w-xs"
						type="number"
						name="requestsPerMinute"
						min="0"
						max="10000"
						value="60"
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
				<button type="submit" class="btn w-fit btn-primary">Générer</button>
			</form>
		</div>
	</div>

	<div class="overflow-x-auto rounded-lg border border-base-300">
		<table class="table table-zebra table-sm">
			<thead>
				<tr>
					<th>Propriétaire</th>
					<th>Préfixe</th>
					<th>Libellé</th>
					<th>Quota</th>
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
						<td>
							<div class="flex flex-col">
								<span class="font-medium">{row.ownerUsername}</span>
								<span class="text-xs text-base-content/70">{row.ownerEmail}</span>
							</div>
						</td>
						<td><code class="text-xs">{row.keyPrefix}{row.kind === 'session' ? '' : '…'}</code></td>
						<td>
							{#if row.kind === 'session'}
								<span class="badge badge-ghost badge-sm">Session</span>
							{/if}
							{row.label || '—'}
						</td>
						<td>{row.requestsPerMinute}</td>
						<td class="tabular-nums">{formatCount(row.totalRequestCount)}</td>
						<td>{formatDt(row.createdAt)}</td>
						<td>{formatDt(row.expiresAt)}</td>
						<td>{formatDt(row.lastUsedAt)}</td>
						<td>
							{#if row.revokedAt}
								<span class="badge badge-sm badge-error">Révoquée</span>
							{:else if row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()}
								<span class="badge badge-sm badge-warning">Expirée</span>
							{:else}
								<span class="badge badge-sm badge-success">Active</span>
							{/if}
						</td>
						<td>
							<div class="flex flex-col gap-1">
								{#if !row.revokedAt}
									<details
										class="collapse-arrow collapse rounded border border-base-300 bg-base-100"
									>
										<summary class="collapse-title min-h-0 px-2 py-1 text-xs font-medium">
											Quota / expiration
										</summary>
										<div class="collapse-content px-2 pb-2">
											<form
												method="post"
												action="?/updateLimits"
												use:enhance
												class="flex flex-col gap-2"
											>
												<input type="hidden" name="id" value={row.id} />
												<input
													class="input-bordered input input-xs w-24"
													type="number"
													name="requestsPerMinute"
													min="0"
													max="10000"
													value={row.requestsPerMinute}
												/>
												{#if row.kind !== 'session'}
													<input
														class="input-bordered input input-xs w-full min-w-40"
														type="datetime-local"
														name="expiresAt"
														value={toLocalInput(row.expiresAt)}
													/>
												{/if}
												<button type="submit" class="btn w-fit btn-xs btn-primary"
													>Enregistrer</button
												>
											</form>
										</div>
									</details>
									{#if row.kind !== 'session'}
										<form method="post" action="?/revoke" use:enhance>
											<input type="hidden" name="id" value={row.id} />
											<button type="submit" class="btn w-fit text-error btn-ghost btn-xs"
												>Révoquer</button
											>
										</form>
									{/if}
								{/if}
							</div>
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan="10" class="text-base-content/70">Aucune clé.</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
