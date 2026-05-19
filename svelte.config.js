import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    typescript: {
      config(config) {
        config.include.push('../drizzle.config.ts');
        // Les segments `.foo` ne sont pas couverts par `src/**/*.ts` (RFC 9116 security.txt, etc.)
        config.include.push('../src/**/.well-known/**/*.ts');
      }
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
        'script-src': ['self'],
        'style-src': ['self', 'unsafe-inline'],
        'img-src': [
          'self',
          'data:',
          'blob:',
          'https://f95zone.to',
          'https://*.f95zone.to',
          'https://lewdcorner.com',
          'https://*.lewdcorner.com',
          'https://avatar-cyan.vercel.app',
          'https://cdn.discordapp.com'
        ],
        'font-src': ['self'],
        'connect-src': ['self'],
        'form-action': ['self'],
        'frame-ancestors': ['none'],
        'object-src': ['none'],
        'upgrade-insecure-requests': true
      }
    }
  }
};

export default config;
