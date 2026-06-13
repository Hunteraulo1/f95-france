<script lang="ts">
	import HatGlasses from '@lucide/svelte/icons/hat-glasses';
	import Scale from '@lucide/svelte/icons/scale';
</script>

<footer
	class="footer footer-center bg-base-200 text-base-content rounded px-4 py-8 sm:px-6 sm:py-10 sm:footer-horizontal"
>
	<nav>
		<ul class="flex flex-col items-center gap-2 sm:flex-row sm:gap-4">
			<li>
				<a
					href="/legals/legal-notice"
					target="_blank"
					class="flex items-center gap-2 text-xs hover:text-primary"
				>
					<Scale size={24} aria-hidden="true" />
					Mentions légales
				</a>
			</li>
			<li>
				<a
					href="/legals/privacy-policy"
					target="_blank"
					class="flex items-center gap-2 text-xs hover:text-primary"
				>
					<HatGlasses size={24} aria-hidden="true" />
					Politique de confidentialité
				</a>
			</li>
		</ul>
		<aside class="max-w-prose px-2 text-center">
			<p class="text-xs text-base-content/80">
				© {new Date().getFullYear()} F95 France — Tous droits réservés
			</p>
		</aside>
	</nav>
</footer>
