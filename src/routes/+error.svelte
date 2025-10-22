<script lang="ts">
	import { page } from '$app/state';
</script>

<main class="flex flex-col h-screen justify-center items-center w-full">
  <h1 class="text-6xl font-black">ERROR {page.status ?? 500}</h1>
  <p class="text-2xl font-bold">{page.error?.message ?? 'An unknown error occurred'}</p>
  <a href="/" class="btn btn-primary mt-8">Retour à l'accueil</a>
</main>
