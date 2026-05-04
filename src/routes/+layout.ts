import { dev } from '$app/environment';
import { injectAnalytics } from '@vercel/analytics/sveltekit';
import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';

injectAnalytics({ mode: dev ? 'development' : 'production' });
// En dev, le script Speed Insights remplace `history.pushState`, ce qui entre en conflit avec
// l’avertissement / le routage SvelteKit. Les vitals restent collectés en preview / prod.
if (!dev) {
	injectSpeedInsights();
}
