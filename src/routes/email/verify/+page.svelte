<script lang="ts">
	import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
	import MailWarning from '@lucide/svelte/icons/mail-warning';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Vérification email — F95 France</title>
</svelte:head>

<div class="flex min-h-[60vh] items-center justify-center bg-base-200 px-4 py-12">
	<div class="card w-full max-w-md border border-base-300 bg-base-100 shadow-xl">
		<div class="card-body gap-4 text-center sm:p-8">
			{#if data.status === 'verified'}
				<CheckCircle2 class="mx-auto text-success" size={48} strokeWidth={1.75} aria-hidden="true" />
				<h1 class="text-2xl font-bold">Email confirmé</h1>
				<p class="text-sm text-base-content/70">
					Votre adresse email a été vérifiée avec succès. Vous pouvez maintenant utiliser votre
					compte.
				</p>
				<a href="/dashboard/login" class="btn btn-primary mt-2">Se connecter</a>
			{:else if data.status === 'expired'}
				<MailWarning class="mx-auto text-warning" size={48} strokeWidth={1.75} aria-hidden="true" />
				<h1 class="text-2xl font-bold">Lien expiré</h1>
				<p class="text-sm text-base-content/70">
					Ce lien de confirmation a expiré. Connectez-vous et demandez un nouvel email de
					vérification.
				</p>
				<a href="/dashboard/login" class="btn btn-primary mt-2">Se connecter</a>
			{:else if data.status === 'missing'}
				<MailWarning class="mx-auto text-warning" size={48} strokeWidth={1.75} aria-hidden="true" />
				<h1 class="text-2xl font-bold">Lien invalide</h1>
				<p class="text-sm text-base-content/70">Aucun jeton de vérification n’a été fourni.</p>
				<a href="/dashboard/login" class="btn btn-ghost mt-2">Retour à la connexion</a>
			{:else}
				<MailWarning class="mx-auto text-error" size={48} strokeWidth={1.75} aria-hidden="true" />
				<h1 class="text-2xl font-bold">Lien invalide</h1>
				<p class="text-sm text-base-content/70">
					Ce lien de confirmation n’est pas valide ou a déjà été utilisé.
				</p>
				<a href="/dashboard/login" class="btn btn-ghost mt-2">Retour à la connexion</a>
			{/if}
		</div>
	</div>
</div>
