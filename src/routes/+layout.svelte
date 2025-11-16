<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { user } from '$lib/stores';
	import '../app.css';
	import type { LayoutServerData } from './$types';

  let { children, data }: { children: any; data: LayoutServerData } = $props();

	// Appliquer le thème depuis les données serveur ou le store utilisateur
	$effect(() => {
		if (typeof document !== 'undefined' && typeof localStorage !== 'undefined') {
			const theme = $user?.theme || data?.user?.theme || 'light';
			document.documentElement.setAttribute('data-theme', theme);
			// Sauvegarder dans localStorage pour éviter le clignotement au prochain chargement
			localStorage.setItem('theme', theme);
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children?.()}
