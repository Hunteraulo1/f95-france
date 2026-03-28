import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Runtime fixé pour le build local (ex. Node 25) et pour Vercel
		adapter: adapter({ runtime: 'nodejs22.x' }),
		// Optimiser le préchargement des ressources
		prerender: {
			handleHttpError: 'warn'
		}
	}
};

export default config;
