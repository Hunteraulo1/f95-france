<script lang="ts">
	import { enhance } from '$app/forms';
	import { startAuthentication } from '@simplewebauthn/browser';

	let { form } = $props();
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
			<input
				name="username"
				class="input-bordered input"
				autocomplete="username webauthn"
				bind:value={username}
			/>
		</label>
		<label class="w-full">
			Mot de passe
			<input
				type="password"
				name="password"
				class="input-bordered input"
				autocomplete="current-password"
			/>
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
		<button
			class="btn btn-secondary"
			type="button"
			onclick={loginWithPasskey}
			disabled={passkeyLoading}
		>
			{passkeyLoading ? 'Connexion...' : "Connexion avec clé d'accès"}
		</button>
		<a href="/dashboard/register" class="btn btn-primary"> Créer un compte </a>
	</div>
</form>

{#if form?.message}
	<p style="color: red">{form.message}</p>
{/if}
{#if passkeyError}
	<p style="color: red">{passkeyError}</p>
{/if}
