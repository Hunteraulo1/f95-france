import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import devtoolsJson from 'vite-plugin-devtools-json';
import path from 'path';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), devtoolsJson()],
	resolve: {
		alias: {
			'@lucide/svelte': path.resolve(__dirname, 'node_modules/@lucide/svelte/dist/lucide-svelte.js')
		}
	},
	build: {
		rollupOptions: {
			external: []
		}
	},
	optimizeDeps: {
		include: ['@lucide/svelte']
	},
	ssr: {
		noExternal: ['@lucide/svelte']
	},
	define: {
		global: 'globalThis'
	}
});
