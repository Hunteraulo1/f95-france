<script lang="ts">
	import { enhance } from '$app/forms';
	import { clearUserData } from '$lib/stores';
	import { onMount } from 'svelte';
	import type { ActionData, PageServerData } from './$types';

	interface Props {
		form: ActionData;
		data: PageServerData;
	}

	let { form, data }: Props = $props();

	onMount(() => {
		clearUserData();
	});
</script>

<div class="min-h-screen flex items-center justify-center bg-base-200">
	<div class="card w-full max-w-md bg-base-100 shadow-xl">
		<div class="card-body text-center">
			<h2 class="card-title justify-center text-2xl font-bold text-error">
				Se déconnecter
			</h2>
			<p class="text-base-content/70 mb-6">
				Êtes-vous sûr de vouloir vous déconnecter ?
			</p>
			
			{#if form?.message}
				<div class="alert alert-error mb-4">
					<span>{form.message}</span>
				</div>
			{/if}

			<div class="card-actions justify-center gap-4">
				<form method="post" action="?/logout" use:enhance>
					<button type="submit" class="btn btn-error">
						Oui, me déconnecter
					</button>
				</form>
				
				<a href="/dashboard" class="btn btn-outline">
					Annuler
				</a>
			</div>
		</div>
	</div>
</div>
