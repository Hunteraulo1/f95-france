<script lang="ts">
	import { page } from '$app/state';

	let isDashboard = false;

	if (page.url.pathname.startsWith('/dashboard')) {
		isDashboard = true;
	}
</script>

<main class="flex h-screen w-full flex-col items-center justify-center">
	<h1 class="text-6xl font-black">ERROR {page.status ?? 500}</h1>
	<p class="text-2xl font-bold">{page.error?.message ?? 'An unknown error occurred'}</p>
	{#if isDashboard}
		<a href="/dashboard" class="btn mt-8 btn-primary">Retour au tableau de bord</a>
	{:else}
		<a href="/" class="btn mt-8 btn-primary">Retour à l'accueil</a>
	{/if}
</main>
