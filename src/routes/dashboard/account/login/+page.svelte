<script lang="ts">
	import { enhance } from '$app/forms';
	import DiscordIcon from '$lib/components/DiscordIcon.svelte';
	import TurnstileWidget from '$lib/components/TurnstileWidget.svelte';
	import { createFormEnhance } from '$lib/forms/enhance';
	import { TURNSTILE_FORM_FIELD } from '$lib/turnstile/constants';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import LogIn from '@lucide/svelte/icons/log-in';
	import { startAuthentication } from '@simplewebauthn/browser';
	import type { ActionData, PageData } from './$types';

	interface Props {
		data: PageData & {
			resetNotice: string | null;
			discordNotice: string | null;
			discordLoginEnabled: boolean;
			discordLoginHref: string;
		};
		form: ActionData;
	}

	let { form, data }: Props = $props();
	let username = $state('');
	let passkeyError = $state('');
	let passkeyLoading = $state(false);
	let captchaToken = $state('');
	let turnstileWidget = $state<TurnstileWidget | undefined>();

	const showCaptcha = $derived(
		Boolean(
			data?.turnstileEnabled &&
			data?.turnstileSiteKey &&
			(data?.requiresCaptcha || form?.requiresCaptcha)
		)
	);

	const loginWithPasskey = async () => {
		passkeyError = '';
		const normalizedUsername = username.trim();

		if (showCaptcha && !captchaToken.trim()) {
			passkeyError = 'Veuillez valider le captcha avant de continuer.';
			return;
		}

		passkeyLoading = true;
		try {
			const optionsRes = await fetch('/api/passkeys/login/options', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					username: normalizedUsername.length > 0 ? normalizedUsername : undefined,
					...(showCaptcha ? { [TURNSTILE_FORM_FIELD]: captchaToken } : {})
				})
			});
			const optionsJson = (await optionsRes.json()) as {
				options?: unknown;
				error?: string;
				requiresCaptcha?: boolean;
			};
			if (!optionsRes.ok || !optionsJson.options) {
				if (optionsJson.requiresCaptcha) {
					window.location.reload();
					return;
				}
				throw new Error(
					optionsJson.error || "Impossible de démarrer la connexion par clé d'accès."
				);
			}

			const response = await startAuthentication({
				optionsJSON: optionsJson.options as Parameters<typeof startAuthentication>[0]['optionsJSON']
			});
			const verifyRes = await fetch('/api/passkeys/login/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					username: normalizedUsername.length > 0 ? normalizedUsername : undefined,
					response,
					...(showCaptcha ? { [TURNSTILE_FORM_FIELD]: captchaToken } : {})
				})
			});
			const verifyJson = (await verifyRes.json()) as { success?: boolean; error?: string };
			if (!verifyRes.ok || !verifyJson.success) {
				const verifyPayload = verifyJson as { requiresCaptcha?: boolean };
				if (verifyPayload.requiresCaptcha) {
					window.location.reload();
					return;
				}
				throw new Error(verifyJson.error || "Échec de la connexion par clé d'accès.");
			}

			window.location.href = data?.redirectTo ?? '/dashboard';
		} catch (error: unknown) {
			passkeyError = error instanceof Error ? error.message : 'Erreur inconnue.';
			turnstileWidget?.resetWidget();
		} finally {
			passkeyLoading = false;
		}
	};
</script>

<svelte:head>
	<title>Connexion — F95 France</title>
</svelte:head>

<div class="flex h-full items-center justify-center bg-base-200 px-4">
	<div class="card w-full max-w-md border border-base-300 bg-base-100 shadow-xl">
		<div class="card-body gap-6 sm:p-8">
			<div class="text-center">
				<div
					class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"
				>
					<LogIn size={28} strokeWidth={1.75} aria-hidden="true" />
				</div>
				<h1 class="text-2xl font-bold tracking-tight">Connexion</h1>
				<p class="mt-2 text-sm text-base-content/70">Accédez au tableau de bord F95 France</p>
			</div>

			{#if data?.discordNotice}
				<div role="alert" class="alert alert-soft text-sm alert-error">
					<span>{data.discordNotice}</span>
				</div>
			{/if}

			{#if data?.resetNotice}
				<div role="alert" class="alert alert-soft text-sm alert-success">
					<span>{data.resetNotice}</span>
				</div>
			{/if}

			{#if data?.registrationNotice}
				<div role="alert" class="alert alert-soft text-sm alert-warning">
					<span>{data.registrationNotice}</span>
				</div>
			{/if}

			<form
				method="post"
				action="?/login"
				use:enhance={createFormEnhance({
					onFailure: () => {
						turnstileWidget?.resetWidget();
					}
				})}
				class="flex flex-col gap-4"
			>
				<input type="hidden" name="redirectTo" value={data?.redirectTo ?? '/dashboard'} />
				<div class="form-control w-full">
					<label class="label pt-0" for="login-username">
						<span class="label-text font-medium">Nom d'utilisateur</span>
					</label>
					<input
						id="login-username"
						name="username"
						type="text"
						class="input-bordered input w-full"
						autocomplete="username webauthn"
						placeholder="Votre pseudo"
						bind:value={username}
					/>
				</div>

				<div class="form-control w-full">
					<div class="label pt-0">
						<label for="login-password">
							<span class="label-text font-medium">Mot de passe</span>
						</label>
					</div>
					<input
						id="login-password"
						type="password"
						name="password"
						class="input-bordered input w-full"
						autocomplete="current-password"
						placeholder="••••••••"
					/>
				</div>

				<div class="form-control w-full">
					<label class="label pt-0 pb-0" for="login-2fa">
						<span class="label-text font-medium">Code 2FA</span>
						<span class="label-text-alt font-normal text-base-content/60">si activé</span>
					</label>
					<input
						id="login-2fa"
						name="twoFactorCode"
						class="input-bordered input w-full"
						inputmode="numeric"
						maxlength="6"
						autocomplete="one-time-code"
						placeholder="000000"
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

				{#if form?.message}
					<div role="alert" class="alert alert-soft text-sm alert-error">
						<span>{form.message}</span>
					</div>
				{/if}

				<div class="mt-2 card-actions flex-col gap-3 px-0">
					<button type="submit" class="btn btn-block gap-2 btn-primary">
						<LogIn size={18} aria-hidden="true" />
						Se connecter
					</button>

					<a
						href="/dashboard/account/forgot-password"
						class="label-text-alt link link-hover link-primary mx-auto mt-2"
					>
						Mot de passe oublié ?
					</a>
				</div>
			</form>

			<div class="divider text-xs text-base-content/50">ou</div>

			<div class="flex flex-col gap-3">
				{#if data?.discordLoginEnabled}
					<a
						href={data.discordLoginHref}
						class="btn btn-block gap-2 bg-[#5865F2] text-white hover:bg-[#4752C4] border-0"
					>
						<DiscordIcon size={18} />
						Se connecter avec Discord
					</a>
				{/if}
				{#if showCaptcha}
					<p class="text-center text-xs text-base-content/60">
						Un captcha est requis après une tentative échouée (mot de passe ou passkey).
					</p>
				{/if}
				<button
					type="button"
					class="btn btn-block gap-2 btn-outline btn-secondary"
					onclick={loginWithPasskey}
					disabled={passkeyLoading}
				>
					<KeyRound size={18} aria-hidden="true" />
					{passkeyLoading ? 'Connexion…' : "Clé d'accès (passkey)"}
				</button>
				{#if passkeyError}
					<div role="alert" class="alert alert-soft text-sm alert-error">
						<span>{passkeyError}</span>
					</div>
				{/if}
			</div>

			{#if data?.registrationEnabled}
				<p class="text-center text-sm text-base-content/70">
					Pas encore de compte ?
					<a href="/dashboard/account/register" class="link font-medium link-primary">Créer un compte</a>
				</p>
			{/if}
		</div>
	</div>
</div>
