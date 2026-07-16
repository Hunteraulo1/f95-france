<script lang="ts">
	import BellOff from '@lucide/svelte/icons/bell-off';
	import MailWarning from '@lucide/svelte/icons/mail-warning';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Désinscription emails — F95 France</title>
</svelte:head>

<div class="flex min-h-[60vh] items-center justify-center bg-base-200 px-4 py-12">
	<div class="card w-full max-w-md border border-base-300 bg-base-100 shadow-xl">
		<div class="card-body gap-4 text-center sm:p-8">
			{#if data.status === 'ok'}
				<BellOff class="mx-auto text-success" size={48} strokeWidth={1.75} aria-hidden="true" />
				<h1 class="text-2xl font-bold">Désinscription confirmée</h1>
				<p class="text-sm text-base-content/70">
					{#if data.username}
						{data.username}, vous
					{:else}
						Vous
					{/if}
					ne recevrez plus d’emails informatifs de F95 France. Les emails essentiels liés à la sécurité
					de votre compte pourront toujours vous être envoyés.
				</p>
				<a href="/" class="btn mt-2 btn-ghost">Retour au site</a>
			{:else if data.status === 'missing'}
				<MailWarning class="mx-auto text-warning" size={48} strokeWidth={1.75} aria-hidden="true" />
				<h1 class="text-2xl font-bold">Lien invalide</h1>
				<p class="text-sm text-base-content/70">Aucun jeton de désinscription n’a été fourni.</p>
			{:else}
				<MailWarning class="mx-auto text-error" size={48} strokeWidth={1.75} aria-hidden="true" />
				<h1 class="text-2xl font-bold">Lien invalide</h1>
				<p class="text-sm text-base-content/70">Ce lien de désinscription n’est pas valide.</p>
			{/if}
		</div>
	</div>
</div>
