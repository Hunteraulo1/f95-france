<script>
	import { enhance } from '$app/forms';
	let { form } = $props();
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

{#if form?.message}
	<p style="color: red">{form.message}</p>
{/if}
