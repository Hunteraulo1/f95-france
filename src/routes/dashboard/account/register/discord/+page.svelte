<script lang="ts">
	import { enhance } from '$app/forms';
	import DiscordIcon from '$lib/components/DiscordIcon.svelte';
	import TurnstileWidget from '$lib/components/TurnstileWidget.svelte';
	import { discordLoginErrorMessage } from '$lib/discord-oauth-url';
	import { createFormEnhance } from '$lib/forms/enhance';
	import { TURNSTILE_FORM_FIELD } from '$lib/turnstile/constants';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import type { ActionData, PageData } from './$types';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();
	let username = $state('');
	let inviteCode = $state('');
	let captchaToken = $state('');
	let turnstileWidget = $state<TurnstileWidget | undefined>();

	$effect(() => {
		const fromForm = form && 'username' in form ? String(form.username ?? '') : '';
		if (fromForm) {
			username = fromForm;
			return;
		}
		if (!username) {
			username = data.suggestedUsername;
		}
	});

	const showCaptcha = $derived(Boolean(data.turnstileEnabled && data.turnstileSiteKey));
	const pageError = $derived(form?.message ?? discordLoginErrorMessage(data.errorCode));
</script>

<svelte:head>
	<title>Compte Discord — F95 France</title>
</svelte:head>

<div class="flex h-full items-center justify-center bg-base-200 px-4">
	<div class="card w-full max-w-md border border-base-300 bg-base-100 shadow-xl">
		<div class="card-body gap-6 sm:p-8">
			<div class="text-center">
				<div
					class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#5865F2]/15 text-[#5865F2]"
				>
					<DiscordIcon size={28} />
				</div>
				<h1 class="text-2xl font-bold tracking-tight">Créer votre compte</h1>
				<p class="mt-2 text-sm text-base-content/70">
					Aucun compte n’est lié à <strong>{data.discordLabel}</strong> sur Discord.
				</p>
				<p class="mt-1 text-xs text-base-content/60">Email Discord : {data.emailMasked}</p>
			</div>

			<form
				method="post"
				action="?/createAccount"
				use:enhance={createFormEnhance({
					onFailure: () => {
						turnstileWidget?.resetWidget();
					},
					updateOnlyOnSuccess: true
				})}
				class="flex flex-col gap-4"
			>
				<div class="form-control w-full">
					<label class="label pt-0" for="discord-register-username">
						<span class="label-text font-medium">Nom d'utilisateur</span>
					</label>
					<input
						id="discord-register-username"
						name="username"
						type="text"
						required
						minlength="3"
						maxlength="32"
						autocomplete="username"
						class="input-bordered input w-full"
						placeholder="Votre pseudo"
						bind:value={username}
					/>
					<label class="label" for="discord-register-username">
						<span class="label-text-alt text-base-content/60">
							3 à 32 caractères — lettres, chiffres, _ et -
						</span>
					</label>
				</div>

				{#if data.requiresInviteCode && !data.hasStoredInvite}
					<div class="form-control w-full">
						<label class="label pt-0" for="discord-register-invite">
							<span class="label-text font-medium">Code d’invitation</span>
						</label>
						<input
							id="discord-register-invite"
							name="inviteCode"
							type="text"
							required
							autocomplete="off"
							class="input-bordered input w-full"
							placeholder="Code fourni par l’équipe"
							bind:value={inviteCode}
						/>
					</div>
				{/if}

				{#if showCaptcha}
					<TurnstileWidget
						bind:this={turnstileWidget}
						siteKey={data.turnstileSiteKey}
						bind:token={captchaToken}
					/>
					<input type="hidden" name={TURNSTILE_FORM_FIELD} value={captchaToken} />
				{/if}

				{#if pageError}
					<div role="alert" class="alert alert-soft text-sm alert-error">
						<span>{pageError}</span>
					</div>
				{/if}

				{#if form && 'redirectToLogin' in form && form.redirectToLogin}
					<p class="text-center text-sm">
						<a href="/dashboard/account/login" class="link link-primary">Retour à la connexion</a>
					</p>
				{/if}

				<div class="card-actions flex-col gap-3 px-0">
					<button type="submit" class="btn btn-block gap-2 btn-primary">
						<UserPlus size={18} aria-hidden="true" />
						Créer mon compte
					</button>
					<a href="/dashboard/account/login" class="btn btn-block btn-ghost btn-sm">Annuler</a>
				</div>
			</form>
		</div>
	</div>
</div>
