<script lang="ts">
	import { enhance } from '$app/forms';
	import { createFormEnhance } from '$lib/forms/enhance';
	import Mail from '@lucide/svelte/icons/mail';
	import MailCheck from '@lucide/svelte/icons/mail-check';
	import type { ActionData, PageData } from './$types';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();
</script>

<svelte:head>
	<title>Vérification email — F95 France</title>
</svelte:head>

<div class="flex h-full items-center justify-center bg-base-200 px-4">
	<div class="card w-full max-w-md border border-base-300 bg-base-100 shadow-xl">
		<div class="card-body gap-6 sm:p-8">
			<div class="text-center">
				<div
					class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"
				>
					{#if data.justVerified}
						<MailCheck size={28} strokeWidth={1.75} aria-hidden="true" />
					{:else}
						<Mail size={28} strokeWidth={1.75} aria-hidden="true" />
					{/if}
				</div>
				<h1 class="text-2xl font-bold tracking-tight">
					{data.justVerified ? 'Email confirmé' : 'Confirmez votre email'}
				</h1>
				<p class="mt-2 text-sm text-base-content/70">
					{#if data.justVerified}
						Votre adresse email est vérifiée. Vous pouvez accéder au tableau de bord.
					{:else}
						Un email de confirmation a été envoyé à
						<span class="font-medium text-base-content">{data.email}</span>. Ouvrez le lien dans le
						message pour activer votre compte.
					{/if}
				</p>
			</div>

			{#if form?.message}
				<div role="alert" class="alert text-sm {form.success ? 'alert-success' : 'alert-error'}">
					<span>{form.message}</span>
				</div>
			{/if}

			{#if !data.smtpConfigured && !data.justVerified}
				<div role="alert" class="alert alert-warning text-sm">
					<span>L’envoi d’emails n’est pas configuré sur ce serveur.</span>
				</div>
			{/if}

			<div class="flex flex-col gap-3">
				{#if data.justVerified}
					<a href="/dashboard" class="btn btn-primary">Accéder au tableau de bord</a>
				{:else}
					<form method="post" action="?/resend" use:enhance={createFormEnhance()} class="w-full">
						<button type="submit" class="btn btn-block btn-primary btn-outline">
							Renvoyer l’email de vérification
						</button>
					</form>
					<form method="post" action="/dashboard/account/logout" class="w-full">
						<button type="submit" class="btn btn-block btn-ghost">Se déconnecter</button>
					</form>
				{/if}
			</div>
		</div>
	</div>
</div>
