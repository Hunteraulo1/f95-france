<script lang="ts">
	import { enhance } from '$app/forms';
	import { createFormEnhance } from '$lib/forms/enhance';
	import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import MailWarning from '@lucide/svelte/icons/mail-warning';
	import type { ActionData, PageData } from './$types';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();

	const showForm = $derived(
		data.status === 'ready' || (form?.token && form.token.length > 0 && !form?.success)
	);
	const tokenValue = $derived(form?.token || data.token || '');
</script>

<svelte:head>
	<title>Nouveau mot de passe — F95 France</title>
</svelte:head>

<div class="flex min-h-[60vh] items-center justify-center bg-base-200 px-4 py-12">
	<div class="card w-full max-w-md border border-base-300 bg-base-100 shadow-xl">
		<div class="card-body gap-6 sm:p-8">
			{#if form?.success}
				<div class="text-center">
					<CheckCircle2
						class="mx-auto text-success"
						size={48}
						strokeWidth={1.75}
						aria-hidden="true"
					/>
					<h1 class="mt-4 text-2xl font-bold">Mot de passe mis à jour</h1>
					<p class="mt-2 text-sm text-base-content/70">{form.message}</p>
					<a href="/dashboard/login?reset=1" class="btn btn-primary btn-block mt-6">Se connecter</a>
				</div>
			{:else if showForm}
				<div class="text-center">
					<div
						class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"
					>
						<KeyRound size={28} strokeWidth={1.75} aria-hidden="true" />
					</div>
					<h1 class="text-2xl font-bold tracking-tight">Nouveau mot de passe</h1>
					<p class="mt-2 text-sm text-base-content/70">
						Choisissez un mot de passe d’au moins 8 caractères.
					</p>
				</div>

				{#if form?.message && !form.success}
					<div role="alert" class="alert alert-error text-sm">
						<span>{form.message}</span>
					</div>
				{/if}

				<form
					method="post"
					action="?/reset"
					use:enhance={createFormEnhance()}
					class="flex flex-col gap-4"
				>
					<input type="hidden" name="token" value={tokenValue} />
					<div class="form-control w-full">
						<label class="label pt-0" for="reset-password">
							<span class="label-text font-medium">Nouveau mot de passe</span>
						</label>
						<input
							id="reset-password"
							name="password"
							type="password"
							required
							minlength="8"
							autocomplete="new-password"
							class="input-bordered input w-full"
							placeholder="••••••••"
						/>
					</div>
					<div class="form-control w-full">
						<label class="label pt-0" for="reset-confirm">
							<span class="label-text font-medium">Confirmer le mot de passe</span>
						</label>
						<input
							id="reset-confirm"
							name="confirmPassword"
							type="password"
							required
							minlength="8"
							autocomplete="new-password"
							class="input-bordered input w-full"
							placeholder="••••••••"
						/>
					</div>
					<button type="submit" class="btn btn-primary btn-block">Enregistrer</button>
				</form>
			{:else if data.status === 'expired'}
				<div class="text-center">
					<MailWarning
						class="mx-auto text-warning"
						size={48}
						strokeWidth={1.75}
						aria-hidden="true"
					/>
					<h1 class="mt-4 text-2xl font-bold">Lien expiré</h1>
					<p class="mt-2 text-sm text-base-content/70">
						Ce lien de réinitialisation a expiré. Demandez-en un nouveau.
					</p>
					<a href="/dashboard/forgot-password" class="btn btn-primary btn-block mt-6">
						Mot de passe oublié
					</a>
				</div>
			{:else}
				<div class="text-center">
					<MailWarning class="mx-auto text-error" size={48} strokeWidth={1.75} aria-hidden="true" />
					<h1 class="mt-4 text-2xl font-bold">Lien invalide</h1>
					<p class="mt-2 text-sm text-base-content/70">
						{#if data.status === 'missing'}
							Aucun jeton de réinitialisation n’a été fourni.
						{:else}
							Ce lien n’est pas valide ou a déjà été utilisé.
						{/if}
					</p>
					<a href="/dashboard/forgot-password" class="btn btn-ghost btn-block mt-4">
						Demander un nouveau lien
					</a>
					<a href="/dashboard/login" class="link mt-2 text-sm link-primary">Retour à la connexion</a
					>
				</div>
			{/if}
		</div>
	</div>
</div>
