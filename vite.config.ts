import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit(), tailwindcss()],
	optimizeDeps: {
		exclude: [
			'@lucide/svelte',
			'svelte-codemirror-editor',
			'codemirror',
			'@codemirror/lang-markdown',
			'@codemirror/state',
			'@codemirror/view',
			'@codemirror/language'
		]
	},
	server: {
		hmr: {
			port: 24678
		},
		fs: {
			allow: ['..']
		},
		headers: {
			'Cache-Control': 'no-store'
		}
	},
	logLevel: 'info'
});
