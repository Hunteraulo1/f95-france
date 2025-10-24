<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageServerData } from './$types';

  interface Props {
    form: ActionData;
    data: PageServerData;
  }

	let { form, data }: Props = $props();
</script>

<form method="post" action="?/login" use:enhance class="flex flex-col gap-2 justify-center items-center">
	<div class="flex gap-2 flex-col w-80">
    <label class="w-full">
      Nom d'utilisateur
      <input
        name="username"
        class="input input-bordered"
      />
    </label>
    <label class="w-full">
      Mot de passe
      <input
        type="password"
        name="password"
        class="input input-bordered"
      />
    </label>
  </div>
	<div class="flex justify-center gap-2 w-full mt-4">
    <button class="btn btn-primary">
        Se connecter
      </button>
    <a
      href="/dashboard/register"
      class="btn btn-primary"
    >
        Créer un compte
      </a>
  </div>
</form>

{#if form?.message}
	<p style="color: red">{form.message}</p>
{/if}
