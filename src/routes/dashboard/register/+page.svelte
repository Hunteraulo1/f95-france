<script lang="ts">
	import { enhance } from '$app/forms';
	import DiscordIcon from '$lib/components/DiscordIcon.svelte';
	import TurnstileWidget from '$lib/components/TurnstileWidget.svelte';
	import { discordOAuthAuthorizePath } from '$lib/discord-oauth-url';
	import { createFormEnhance } from '$lib/forms/enhance';
	import { TURNSTILE_FORM_FIELD } from '$lib/turnstile/constants';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import type { ActionData } from './$types';

	interface Props {
		form: ActionData & { errors?: Record<string, string> };
		data: {
			requiresInviteCode: boolean;
			discordLoginEnabled: boolean;
			turnstileSiteKey: string;
			turnstileEnabled: boolean;
		};
	}

	let { form, data }: Props = $props();
	let captchaToken = $state('');
	let inviteCode = $state('');
	let turnstileWidget = $state<TurnstileWidget | undefined>();

	const showCaptcha = $derived(Boolean(data?.turnstileEnabled && data?.turnstileSiteKey));
	const discordRegisterHref = $derived(
		discordOAuthAuthorizePath({
			inviteCode: data?.requiresInviteCode ? inviteCode : undefined
		})
	);
</script>

<svelte:head>
	<title>Inscription — F95 France</title>
</svelte:head>

<div class="flex h-full items-center justify-center bg-base-200 px-4">
	<div class="card w-full max-w-md border border-base-300 bg-base-100 shadow-xl">
		<div class="card-body gap-6 sm:p-8">
			<div class="text-center">
				<div
					class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"
				>
					<UserPlus size={28} strokeWidth={1.75} aria-hidden="true" />
				</div>
				<h1 class="text-2xl font-bold tracking-tight">Créer un compte</h1>
				<p class="mt-2 text-sm text-base-content/70">Rejoignez la communauté F95 France</p>
			</div>

			<form
				method="post"
				action="?/register"
				use:enhance={createFormEnhance({
					onFailure: () => {
						turnstileWidget?.resetWidget();
					}
				})}
				class="flex flex-col gap-4"
			>
				<div class="form-control w-full">
					<label class="label pt-0" for="register-username">
						<span class="label-text font-medium">Nom d'utilisateur</span>
					</label>
					<input
						id="register-username"
						name="username"
						autocomplete="username"
						type="text"
						required
						class="input-bordered input w-full"
						placeholder="Votre pseudo"
					/>
					{#if form?.errors?.username}
						<label class="label" for="register-username">
							<span class="label-text-alt text-error">{form.errors.username}</span>
						</label>
					{/if}
				</div>

				<div class="form-control w-full">
					<label class="label pt-0" for="register-email">
						<span class="label-text font-medium">Adresse email</span>
					</label>
					<input
						id="register-email"
						name="email"
						autocomplete="email"
						type="email"
						required
						class="input-bordered input w-full"
						placeholder="vous@exemple.fr"
					/>
					{#if form?.errors?.email}
						<label class="label" for="register-email">
							<span class="label-text-alt text-error">{form.errors.email}</span>
						</label>
					{/if}
				</div>

				{#if data?.requiresInviteCode}
					<div class="form-control w-full">
						<label class="label pt-0" for="register-invite">
							<span class="label-text font-medium">Code d’invitation</span>
						</label>
						<input
							id="register-invite"
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

				<div class="form-control w-full">
					<label class="label pt-0" for="register-password">
						<span class="label-text font-medium">Mot de passe</span>
					</label>
					<input
						id="register-password"
						name="password"
						autocomplete="new-password"
						type="password"
						required
						class="input-bordered input w-full"
						placeholder="••••••••"
					/>
					{#if form?.errors?.password}
						<label class="label" for="register-password">
							<span class="label-text-alt text-error">{form.errors.password}</span>
						</label>
					{/if}
				</div>

				<div class="form-control w-full">
					<label class="label pt-0" for="register-confirm">
						<span class="label-text font-medium">Confirmer le mot de passe</span>
					</label>
					<input
						id="register-confirm"
						name="confirmPassword"
						autocomplete="new-password"
						type="password"
						required
						class="input-bordered input w-full"
						placeholder="••••••••"
					/>
					{#if form?.errors?.confirmPassword}
						<label class="label" for="register-confirm">
							<span class="label-text-alt text-error">{form.errors.confirmPassword}</span>
						</label>
					{/if}
				</div>

				{#if showCaptcha}
					<TurnstileWidget
						bind:this={turnstileWidget}
						siteKey={data.turnstileSiteKey}
						bind:token={captchaToken}
					/>
					<input type="hidden" name={TURNSTILE_FORM_FIELD} value={captchaToken} />
				{/if}

				{#if form?.message}
					<div role="alert" class="alert alert-soft text-sm alert-error">
						<span>{form.message}</span>
					</div>
				{/if}

				<div class="mt-2 card-actions flex-col gap-3 px-0">
					<button type="submit" class="btn btn-block gap-2 btn-primary">
						<UserPlus size={18} aria-hidden="true" />
						Créer le compte
					</button>
				</div>
			</form>

			{#if data?.discordLoginEnabled}
				<div class="divider text-xs text-base-content/50">ou</div>
				<a
					href={discordRegisterHref}
					class="btn btn-block gap-2 bg-[#5865F2] text-white hover:bg-[#4752C4] border-0"
				>
					<DiscordIcon size={18} />
					S’inscrire avec Discord
				</a>
				{#if data.requiresInviteCode && !inviteCode.trim()}
					<p class="text-center text-xs text-base-content/60">
						Saisissez votre code d’invitation ci-dessus avant de continuer avec Discord.
					</p>
				{/if}
			{/if}

			<p class="text-center text-sm text-base-content/70">
				Déjà un compte ?
				<a href="/dashboard/login" class="link font-medium link-primary">Se connecter</a>
			</p>
		</div>
	</div>
</div>
