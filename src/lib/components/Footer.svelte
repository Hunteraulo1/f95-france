<script lang="ts">
	import { SITE } from '$lib/site';
	import HatGlasses from '@lucide/svelte/icons/hat-glasses';
	import Scale from '@lucide/svelte/icons/scale';
</script>

<footer class="footer footer-horizontal footer-center bg-base-200 text-base-content rounded p-10">
	<nav class="grid grid-flow-col gap-4">
		<a class="link link-hover" href="/">Accueil</a>
		<a class="link link-hover" href="/games">Jeux</a>
		<a class="link link-hover" href="/translators">Traducteurs</a>
		<a class="link link-hover" href="/updates">Mises à jour</a>
		<a
			class="link link-hover"
			href={SITE.discordInviteUrl}
			target="_blank"
			rel="noopener noreferrer">Discord</a
		>
		<a
			class="link link-hover"
			href={SITE.extensionDownloadUrl}
			target="_blank"
			rel="noopener noreferrer">Extension</a
		>
		<a class="link link-hover" href="/dashboard">Tableau de bord</a>
	</nav>
	<nav>
		<ul class="flex gap-4">
			<a href="/legal-notice">
				<li class="flex items-center gap-2 text-xs hover:text-primary">
					<Scale size={24} /> Mentions légales
				</li>
			</a>
			<a href="/privacy-policy">
				<li class="flex items-center gap-2 text-xs hover:text-primary">
					<HatGlasses size={24} /> Politique de confidentialité
				</li>
			</a>
		</ul>
	</nav>
	<aside>
		<p class="text-xs text-base-content/80">
			Copyright © {new Date().getFullYear()} - All right reserved by F95 France
		</p>
	</aside>
</footer>
