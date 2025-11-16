<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { user } from '$lib/stores';
	import '../app.css';
	import type { LayoutServerData } from './$types';

  let { children, data }: { children: any; data: LayoutServerData } = $props();

	// Appliquer le thème depuis les données serveur ou le store utilisateur
	$effect(() => {
		if (typeof document !== 'undefined' && typeof localStorage !== 'undefined') {
			const theme = $user?.theme || data?.user?.theme || localStorage.getItem('theme') || 'light';
			document.documentElement.setAttribute('data-theme', theme);
			// Sauvegarder dans localStorage pour éviter le clignotement au prochain chargement
			localStorage.setItem('theme', theme);
			// Mettre à jour la couleur de fond si nécessaire
			if (theme === 'dark') {
				document.documentElement.style.backgroundColor = '#1f2937';
				document.body.style.backgroundColor = '#1f2937';
			} else {
				document.documentElement.style.backgroundColor = '';
				document.body.style.backgroundColor = '';
			}
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children?.()}
