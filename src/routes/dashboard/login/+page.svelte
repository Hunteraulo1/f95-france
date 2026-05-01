<script lang="ts">
	import { enhance } from '$app/forms';
	import { startAuthentication } from '@simplewebauthn/browser';

	let { form } = $props();
	let passkeyUsername = $state('');
	let passkeyError = $state('');
	let passkeyLoading = $state(false);

	const loginWithPasskey = async () => {
		passkeyError = '';
		const username = passkeyUsername.trim();
		if (!username) {
			passkeyError = "Renseigne d'abord ton nom d'utilisateur.";
			return;
		}

		passkeyLoading = true;
		try {
			const optionsRes = await fetch('/api/passkeys/login/options', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username })
			});
			const optionsJson = (await optionsRes.json()) as { options?: unknown; error?: string };
			if (!optionsRes.ok || !optionsJson.options) {
				throw new Error(optionsJson.error || "Impossible de démarrer la connexion par clé d'accès.");
			}

			const response = await startAuthentication({
				optionsJSON: optionsJson.options as Parameters<typeof startAuthentication>[0]['optionsJSON']
			});
			const verifyRes = await fetch('/api/passkeys/login/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, response })
			});
			const verifyJson = (await verifyRes.json()) as { success?: boolean; error?: string };
			if (!verifyRes.ok || !verifyJson.success) {
				throw new Error(verifyJson.error || "Échec de la connexion par clé d'accès.");
			}

			window.location.href = '/dashboard';
		} catch (error: unknown) {
			passkeyError = error instanceof Error ? error.message : 'Erreur inconnue.';
		} finally {
			passkeyLoading = false;
		}
	};
</script>

<form
	method="post"
	action="?/login"
	use:enhance
	class="flex flex-col items-center justify-center gap-2"
>
	<div class="flex flex-col gap-2">
		<label class="w-full">
			Nom d'utilisateur
			<input name="username" class="input-bordered input" autocomplete="username" />
		</label>
		<label class="w-full">
			Mot de passe
			<input type="password" name="password" class="input-bordered input" autocomplete="current-password" />
		</label>
		<label class="w-full">
			Code 2FA (si activée)
			<input
				name="twoFactorCode"
				class="input-bordered input"
				inputmode="numeric"
				maxlength="6"
				autocomplete="one-time-code"
			/>
		</label>
	</div>
	<div class="mt-4 flex w-full justify-center gap-2">
		<button class="btn btn-primary"> Se connecter </button>
		<a href="/dashboard/register" class="btn btn-primary"> Créer un compte </a>
	</div>
</form>

<div class="mt-3 flex w-full max-w-md flex-col gap-2">
	<label class="w-full">
		Nom d'utilisateur (clé d'accès)
		<input class="input-bordered input" bind:value={passkeyUsername} autocomplete="username webauthn" />
	</label>
	<button class="btn btn-secondary" type="button" onclick={loginWithPasskey} disabled={passkeyLoading}>
		{passkeyLoading ? 'Connexion...' : "Se connecter avec une clé d'accès"}
	</button>
</div>

{#if form?.message}
	<p style="color: red">{form.message}</p>
{/if}
{#if passkeyError}
	<p style="color: red">{passkeyError}</p>
{/if}
