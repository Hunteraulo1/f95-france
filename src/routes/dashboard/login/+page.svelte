<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	interface Props {
		form: ActionData;
	}

	let { form }: Props = $props();
</script>

<form
	method="post"
	action="?/login"
	use:enhance
	class="flex flex-col items-center justify-center gap-2"
>
	<div class="flex w-80 flex-col gap-2">
		<label class="w-full">
			Nom d'utilisateur
			<input name="username" class="input-bordered input" />
		</label>
		<label class="w-full">
			Mot de passe
			<input type="password" name="password" class="input-bordered input" />
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
