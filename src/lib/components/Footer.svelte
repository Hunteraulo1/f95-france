<script lang="ts">
	import HatGlasses from '@lucide/svelte/icons/hat-glasses';
	import Scale from '@lucide/svelte/icons/scale';
</script>

<footer
	class="footer footer-center bg-base-200 text-base-content rounded px-4 py-8 sm:px-6 sm:py-10 sm:footer-horizontal"
>
	<nav
		class="flex max-w-full flex-col items-center gap-2 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4 text-xs xs:text-sm"
	>
		<a class="hover:text-primary" href="/">Accueil</a>
		<a class="hover:text-primary" href="/games">Jeux</a>
		<a class="hover:text-primary" href="/translators">Traducteurs</a>
		<a class="hover:text-primary" href="/updates">Mises à jour</a>
		<a class="hover:text-primary" href="/dashboard">Tableau de bord</a>
	</nav>
	<nav>
		<ul class="flex flex-col items-center gap-2 sm:flex-row sm:gap-4">
			<li>
				<a href="/legal-notice" class="flex items-center gap-2 text-xs hover:text-primary">
					<Scale size={24} aria-hidden="true" />
					Mentions légales
				</a>
			</li>
			<li>
				<a href="/privacy-policy" class="flex items-center gap-2 text-xs hover:text-primary">
					<HatGlasses size={24} aria-hidden="true" />
					Politique de confidentialité
				</a>
			</li>
		</ul>
		<aside class="max-w-prose px-2 text-center">
			<p class="text-xs text-base-content/80">
				Copyright © {new Date().getFullYear()} - All right reserved by F95 France
			</p>
		</aside>
	</nav>
</footer>
