<script lang="ts">
	import { enhance } from '$app/forms';
	import TurnstileWidget from '$lib/components/TurnstileWidget.svelte';
	import { createFormEnhance } from '$lib/forms/enhance';
	import { TURNSTILE_FORM_FIELD } from '$lib/turnstile/constants';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import type { ActionData, PageData } from './$types';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();
	let captchaToken = $state('');
	let turnstileWidget = $state<TurnstileWidget | undefined>();

	const showCaptcha = $derived(Boolean(data.turnstileEnabled && data.turnstileSiteKey));
</script>

<svelte:head>
	<title>Mot de passe oublié — F95 France</title>
</svelte:head>

<div class="flex h-full items-center justify-center bg-base-200 px-4">
	<div class="card w-full max-w-md border border-base-300 bg-base-100 shadow-xl">
		<div class="card-body gap-6 sm:p-8">
			<div class="text-center">
				<div
					class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"
				>
					<KeyRound size={28} strokeWidth={1.75} aria-hidden="true" />
				</div>
				<h1 class="text-2xl font-bold tracking-tight">Mot de passe oublié</h1>
				<p class="mt-2 text-sm text-base-content/70">
					Saisissez l’adresse email de votre compte. Nous vous enverrons un lien pour choisir un
					nouveau mot de passe.
				</p>
			</div>

			{#if !data.smtpConfigured}
				<div role="alert" class="alert alert-warning text-sm">
					<span>L’envoi d’emails n’est pas configuré sur ce serveur.</span>
				</div>
			{/if}

			{#if form?.message}
				<div
					role="alert"
					class="alert text-sm {form.success ? 'alert-success' : 'alert-error'}"
				>
					<span>{form.message}</span>
				</div>
			{/if}

			<form
				method="post"
				use:enhance={createFormEnhance({
					onFailure: () => {
						turnstileWidget?.resetWidget();
					}
				})}
				class="flex flex-col gap-4"
			>
				<div class="form-control w-full">
					<label class="label pt-0" for="forgot-email">
						<span class="label-text font-medium">Adresse email</span>
					</label>
					<input
						id="forgot-email"
						name="email"
						type="email"
						required
						autocomplete="email"
						class="input-bordered input w-full"
						placeholder="vous@exemple.fr"
					/>
				</div>

				{#if showCaptcha}
					<TurnstileWidget
						bind:this={turnstileWidget}
						siteKey={data.turnstileSiteKey}
						bind:token={captchaToken}
					/>
					<input type="hidden" name={TURNSTILE_FORM_FIELD} value={captchaToken} />
				{/if}

				<button type="submit" class="btn btn-primary btn-block">Envoyer le lien</button>
			</form>

			<p class="text-center text-sm text-base-content/70">
				<a href="/dashboard/login" class="link font-medium link-primary">Retour à la connexion</a>
			</p>
		</div>
	</div>
</div>
