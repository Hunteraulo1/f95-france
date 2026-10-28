import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

/** Origines autorisées pour les actions POST (CSRF) — localhost + URL publique au build. */
function buildTrustedOrigins() {
	const origins = [
		'http://localhost:3000',
		'http://127.0.0.1:3000',
		'http://localhost:4173',
		'http://127.0.0.1:4173',
		'http://localhost:5173',
		'http://127.0.0.1:5173'
	];
	const serviceUrlApp = process.env.SERVICE_URL_APP?.trim();

	if (serviceUrlApp) origins.push(serviceUrlApp);

	return [...new Set(origins)];
}

export default defineConfig({
	plugins: [
		sveltekit({
			preprocess: vitePreprocess(),
			csrf: {
				trustedOrigins: buildTrustedOrigins()
			},
			adapter: adapter({ runtime: 'nodejs24.x' }),
			prerender: {
				handleHttpError: 'warn'
			},
			csp: {
				mode: 'auto',
				directives: {
					'default-src': ['self'],
					'base-uri': ['self'],
					'script-src': ['self', 'https://challenges.cloudflare.com'],
					'style-src': ['self', 'unsafe-inline'],
					'img-src': [
						'self',
						'data:',
						'blob:',
						'https:',
						'https://f95zone.to',
						'https://*.f95zone.to',
						'https://lewdcorner.com',
						'https://*.lewdcorner.com',
						'https://zupimages.net',
						'https://*.zupimages.net',
						'https://itch.zone',
						'https://*.itch.zone',
						'https://itch.io',
						'https://*.itch.io',
						'https://ibb.co',
						'https://*.ibb.co',
						'https://postimg.cc',
						'https://*.postimg.cc',
						'https://avatar-cyan.vercel.app',
						'https://cdn.discordapp.com'
					],
					'font-src': ['self'],
					'connect-src': [
						'self',
						'https://www.youtube.com',
						'https://www.youtube-nocookie.com',
						'https://www.google.com',
						'https://challenges.cloudflare.com'
					],
					'form-action': ['self'],
					'frame-src': [
						'self',
						'https://www.youtube.com',
						'https://www.youtube-nocookie.com',
						'https://music.youtube.com',
						'https://challenges.cloudflare.com'
					],
					'frame-ancestors': ['none'],
					'object-src': ['none'],
					'upgrade-insecure-requests': true
				}
			}
		}),
		tailwindcss()
	],
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
		host: '0.0.0.0',
		port: 5173,
		strictPort: true,
		hmr: {
			host: 'localhost',
			clientPort: 5173,
			protocol: 'ws'
		},
		watch: {
			usePolling: true // utile dans Docker
		},
		fs: {
			allow: ['..']
		},
		// En dev, certains utilisateurs récupèrent un "mauvais" contenu (HTML/404)
		// depuis le cache navigateur et les modules Vite ne se rechargent plus.
		// Désactiver le cache rend le runtime SvelteKit beaucoup plus stable.
		headers: {
			'Cache-Control': 'no-store'
		}
	},
	logLevel: 'info'
});
