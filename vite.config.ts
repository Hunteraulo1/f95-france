import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
// import devtoolsJson from 'vite-plugin-devtools-json';

export default defineConfig({
	plugins: [sveltekit(), tailwindcss()],
	optimizeDeps: {
		exclude: ['@lucide/svelte']
	},
	server: {
		fs: {
			allow: ['..']
		},
		// En dev, certains utilisateurs récupèrent un "mauvais" contenu (HTML/404)
		// depuis le cache navigateur et les modules Vite ne se rechargent plus.
		// Désactiver le cache rend le runtime SvelteKit beaucoup plus stable.
		headers: {
			'Cache-Control': 'no-store'
		}
	}
});
