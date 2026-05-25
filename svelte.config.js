import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    csrf: {
      trustedOrigins: [
        'http://localhost:4173',
        'http://127.0.0.1:4173',
        'http://localhost:5173',
        'http://127.0.0.1:5173'
      ]
    },
    typescript: {
      config(config) {
        config.include.push('../drizzle.config.ts');
        // Les segments avec `.` ne sont pas couverts par `src/**/*.ts` (security.txt, robots.txt, etc.)
        config.include.push('../src/**/.well-known/**/*.ts');
        config.include.push('../src/routes/robot.txt/**/*.ts');
        config.include.push('../src/routes/robots.txt/**/*.ts');
        config.include.push('../src/routes/sitemap.xml/**/*.ts');
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
        'script-src': ['self', 'https://www.youtube.com'],
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
        'connect-src': ['self', 'https://www.youtube.com', 'https://www.google.com'],
        'form-action': ['self'],
        'frame-src': [
          'self',
          'https://www.youtube.com',
          'https://www.youtube-nocookie.com',
          'https://music.youtube.com'
        ],
        'frame-ancestors': ['none'],
        'object-src': ['none'],
        'upgrade-insecure-requests': true
      }
    }
  }
};

export default config;
