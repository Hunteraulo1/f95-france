<script lang="ts">
	import { enhance } from '$app/forms';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import LogIn from '@lucide/svelte/icons/log-in';
	import { startAuthentication } from '@simplewebauthn/browser';

	let { form, data } = $props();
	let username = $state('');
	let passkeyError = $state('');
	let passkeyLoading = $state(false);

	const loginWithPasskey = async () => {
		passkeyError = '';
		const normalizedUsername = username.trim();

		passkeyLoading = true;
		try {
			const optionsRes = await fetch('/api/passkeys/login/options', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					username: normalizedUsername.length > 0 ? normalizedUsername : undefined
				})
			});
			const optionsJson = (await optionsRes.json()) as { options?: unknown; error?: string };
			if (!optionsRes.ok || !optionsJson.options) {
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
					response
				})
			});
			const verifyJson = (await verifyRes.json()) as { success?: boolean; error?: string };
			if (!verifyRes.ok || !verifyJson.success) {
				throw new Error(verifyJson.error || "Échec de la connexion par clé d'accès.");
			}

			window.location.href = data?.redirectTo ?? '/dashboard';
		} catch (error: unknown) {
			passkeyError = error instanceof Error ? error.message : 'Erreur inconnue.';
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

			{#if data?.registrationNotice}
				<div role="alert" class="alert alert-soft text-sm alert-warning">
					<span>{data.registrationNotice}</span>
				</div>
			{/if}

			<form method="post" action="?/login" use:enhance class="flex flex-col gap-4">
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
					<label class="label pt-0" for="login-password">
						<span class="label-text font-medium">Mot de passe</span>
					</label>
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
				</div>
			</form>

			<div class="divider text-xs text-base-content/50">ou</div>

			<div class="flex flex-col gap-3">
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
					<a href="/dashboard/register" class="link font-medium link-primary">Créer un compte</a>
				</p>
			{/if}
		</div>
	</div>
</div>
