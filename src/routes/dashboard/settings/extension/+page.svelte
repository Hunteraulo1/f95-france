<script lang="ts">
	import { createFormEnhance } from '$lib/forms/enhance';
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	let error = $state<string | null>(null);
	let info = $state<string | null>(null);
	let generatedCode = $state<string | null>(null);
	let codeExpiresAt = $state<string | null>(null);
	let copied = $state(false);

	const formatDate = (value: string | Date | null) =>
		value ? new Date(value).toLocaleString('fr-FR') : 'Jamais';

	const copyCode = async () => {
		if (!generatedCode) return;
		try {
			await navigator.clipboard.writeText(generatedCode);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			copied = false;
		}
	};
</script>

<section class="flex flex-col gap-8">
	<div class="flex flex-col gap-2">
		<h2 class="text-lg font-semibold text-base-content">Extension navigateur</h2>
		<p class="text-sm text-base-content/70">
			Liez votre compte à l’extension F95 France pour synchroniser vos filtres sauvegardés entre le
			site et l’extension. Pas encore installée&nbsp;?
			<a href={data.extensionStoreUrl} target="_blank" rel="noopener" class="link link-hover">
				Télécharger l’extension
			</a>.
		</p>
	</div>

	{#if error}
		<div class="alert alert-error"><span>{error}</span></div>
	{/if}
	{#if info}
		<div class="alert alert-success"><span>{info}</span></div>
	{/if}

	<div class="flex flex-col gap-4">
		<div class="card w-full border border-base-300 bg-base-100 shadow-xl">
			<div class="card-body gap-6 sm:py-8">
				<div class="flex flex-col gap-1">
					<h3 class="font-semibold">Lier un appareil</h3>
					<p class="text-sm text-base-content/70">
						Générez un code, puis dans l’extension&nbsp;: <strong
							>Paramètres → Lier le compte</strong
						>
						et collez le code. Le code est valable {data.linkCodeTtlMinutes} minutes et à usage unique.
					</p>
				</div>

				<form
					method="POST"
					action="?/generateCode"
					use:enhance={createFormEnhance({
						onStart: () => {
							error = null;
							info = null;
						},
						onFailure: (message) => {
							error = message;
						},
						onSuccess: (result) => {
							const payload = result.data as { code?: string; expiresAt?: string };
							generatedCode = payload.code ?? null;
							codeExpiresAt = payload.expiresAt ?? null;
							copied = false;
						}
					})}
				>
					<button type="submit" class="btn btn-primary">
						{generatedCode ? 'Générer un nouveau code' : 'Générer un code de liaison'}
					</button>
				</form>

				{#if generatedCode}
					<div class="flex flex-col gap-2 rounded-box border border-base-300 p-4">
						<span class="text-sm text-base-content/70">Votre code de liaison&nbsp;:</span>
						<div class="flex flex-wrap items-center gap-3">
							<code class="text-2xl font-bold tracking-[0.3em] select-all">{generatedCode}</code>
							<button type="button" class="btn btn-ghost btn-sm" onclick={copyCode}>
								{copied ? 'Copié !' : 'Copier'}
							</button>
						</div>
						{#if codeExpiresAt}
							<span class="text-xs text-base-content/60">
								Expire à {formatDate(codeExpiresAt)}. Générer un nouveau code annule le précédent.
							</span>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<div class="flex flex-col gap-4">
		<h3 class="font-semibold">Appareils liés</h3>
		<div class="card w-full border border-base-300 bg-base-100 shadow-xl">
			<div class="card-body gap-6 sm:py-8">
				{#if data.devices.length === 0}
					<p class="text-sm text-base-content/70">Aucun appareil lié pour le moment.</p>
				{:else}
					<div class="w-full overflow-x-auto">
						<table class="table table-zebra">
							<thead>
								<tr>
									<th>Clé</th>
									<th>Liée le</th>
									<th>Dernière sync</th>
									<th class="text-right">Action</th>
								</tr>
							</thead>
							<tbody>
								{#each data.devices as device (device.id)}
									<tr>
										<td><code>{device.keyPrefix}…</code></td>
										<td>{formatDate(device.createdAt)}</td>
										<td>{formatDate(device.lastUsedAt)}</td>
										<td class="text-right">
											<form
												method="POST"
												action="?/revokeDevice"
												use:enhance={createFormEnhance({
													invalidateAll: true,
													onStart: () => {
														error = null;
														info = null;
													},
													onFailure: (message) => {
														error = message;
													},
													onSuccess: () => {
														info = 'Appareil délié.';
													}
												})}
											>
												<input type="hidden" name="id" value={device.id} />
												<button type="submit" class="btn btn-error btn-sm">Délier</button>
											</form>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		</div>
	</div>
</section>
