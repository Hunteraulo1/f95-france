<script lang="ts">
	import { createFormEnhance } from '$lib/forms/enhance';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import {
		BRIDGE_TO_EXTENSION,
		isExtensionToSiteMessage,
		type SiteToExtensionMessage
	} from '$lib/extension-bridge';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	let error = $state<string | null>(null);
	let info = $state<string | null>(null);
	let generatedCode = $state<string | null>(null);
	let codeExpiresAt = $state<string | null>(null);
	let copied = $state(false);

	/** L’extension a répondu au ping : liaison en un clic disponible. */
	let extensionDetected = $state(false);
	/** Échange du code en cours côté extension. */
	let linking = $state(false);
	/** Liaison réussie : on invite l’utilisateur à fermer l’onglet (parcours auto). */
	let linked = $state(false);

	/** Référence du formulaire de génération, pour le déclencher en mode auto-link. */
	let generateForm = $state<HTMLFormElement | null>(null);
	/** Garde-fou : on ne lance la liaison automatique qu’une seule fois. */
	let autoLinkTriggered = $state(false);

	const formatDate = (value: string | Date | null) =>
		value ? new Date(value).toLocaleString('fr-FR') : 'Jamais';

	const postToExtension = (message: SiteToExtensionMessage) => {
		console.debug('[ext-bridge] site → extension', message);
		window.postMessage(message, window.location.origin);
	};

	/** Envoie le code fraîchement généré à l’extension pour liaison automatique. */
	const linkWithExtension = (code: string) => {
		if (!extensionDetected) return;
		linking = true;
		postToExtension({ channel: BRIDGE_TO_EXTENSION, type: 'link', code });
	};

	// Parcours « 1 clic » : l’extension ouvre cette page avec ?autolink=1. Dès
	// qu’elle est détectée, on génère le code et on lie sans clic supplémentaire.
	$effect(() => {
		if (!data.autolink || autoLinkTriggered) return;
		if (!extensionDetected || linking || linked) return;
		autoLinkTriggered = true;
		generateForm?.requestSubmit();
	});

	onMount(() => {
		const onMessage = (event: MessageEvent) => {
			// NB : on NE compare PAS event.source à window — pour un message émis par le
			// content script de l'extension (wrappers Xray Firefox), la référence diffère
			// et le pong/linked serait rejeté à tort. L'origine + isExtensionToSiteMessage
			// (channel + type) suffisent à valider la provenance.
			if (event.origin !== window.location.origin) return;
			if (!isExtensionToSiteMessage(event.data)) return;
			console.debug('[ext-bridge] extension → site', event.data);

			if (event.data.type === 'pong') {
				extensionDetected = true;
				return;
			}

			// type === 'linked'
			linking = false;
			if (event.data.ok) {
				error = null;
				linked = true;
				info = 'Extension connectée. Vous pouvez fermer cet onglet.';
				void invalidateAll();
			} else {
				error = event.data.error ?? 'La liaison de l’extension a échoué.';
			}
		};

		window.addEventListener('message', onMessage);
		// Le content script peut s’annoncer seul ; on ping aussi (avec un second
		// essai) pour couvrir le cas où il se charge après nous.
		postToExtension({ channel: BRIDGE_TO_EXTENSION, type: 'ping' });
		const retry = setTimeout(
			() => postToExtension({ channel: BRIDGE_TO_EXTENSION, type: 'ping' }),
			500
		);

		return () => {
			clearTimeout(retry);
			window.removeEventListener('message', onMessage);
		};
	});

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
					<div class="flex flex-wrap items-center gap-2">
						<h3 class="font-semibold">Lier un appareil</h3>
						{#if extensionDetected}
							<span class="badge badge-success badge-sm">Extension détectée</span>
						{/if}
					</div>
					<p class="text-sm text-base-content/70">
						{#if linked}
							Votre extension est connectée à votre compte. Vous pouvez fermer cet onglet.
						{:else if extensionDetected}
							Cliquez sur <strong>Connecter l’extension</strong> : la liaison se fait automatiquement,
							sans copier-coller.
						{:else}
							Générez un code, puis dans l’extension&nbsp;: <strong
								>Paramètres → Lier le compte</strong
							>
							et collez le code. Le code est valable {data.linkCodeTtlMinutes} minutes et à usage unique.
						{/if}
					</p>
				</div>

				<form
					method="POST"
					action="?/generateCode"
					bind:this={generateForm}
					use:enhance={createFormEnhance({
						onStart: () => {
							error = null;
							info = null;
						},
						onFailure: (message) => {
							error = message;
							linking = false;
						},
						onSuccess: (result) => {
							const payload = result.data as { code?: string; expiresAt?: string };
							generatedCode = payload.code ?? null;
							codeExpiresAt = payload.expiresAt ?? null;
							copied = false;
							if (generatedCode) linkWithExtension(generatedCode);
						}
					})}
				>
					<button type="submit" class="btn btn-primary" disabled={linking || linked}>
						{#if linking}
							<span class="loading loading-spinner loading-sm"></span>
							Connexion en cours…
						{:else if extensionDetected}
							Connecter l’extension
						{:else}
							{generatedCode ? 'Générer un nouveau code' : 'Générer un code de liaison'}
						{/if}
					</button>
				</form>

				{#if generatedCode}
					<div class="flex flex-col gap-2 rounded-box border border-base-300 p-4">
						<span class="text-sm text-base-content/70">
							{#if extensionDetected}
								Si la liaison automatique échoue, collez ce code dans l’extension&nbsp;:
							{:else}
								Votre code de liaison&nbsp;:
							{/if}
						</span>
						<div class="flex flex-wrap items-center gap-3">
							<code class="text-2xl font-bold tracking-[0.3em] select-all">{generatedCode}</code>
							<button type="button" class="btn btn-sm btn-ghost" onclick={copyCode}>
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
												<button type="submit" class="btn btn-sm btn-error">Délier</button>
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
