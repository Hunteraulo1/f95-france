import { absoluteUrl, siteOrigin } from '$lib/site';

/** Pages accessibles sans authentification (indexables). */
export const SITEMAP_PUBLIC_PATHS = [
	{ path: '/', changefreq: 'weekly' as const, priority: 1 },
	{ path: '/dashboard/login', changefreq: 'monthly' as const, priority: 0.4 },
	{ path: '/dashboard/register', changefreq: 'monthly' as const, priority: 0.4 }
] as const;

function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/** Génère un document sitemap.xml (schéma sitemaps.org 0.9). */
export function buildSitemapXml(publicOrigin?: string | null): string {
	const origin = siteOrigin(publicOrigin);
	const lastmod = new Date().toISOString().slice(0, 10);

	const urlEntries = SITEMAP_PUBLIC_PATHS.map(({ path, changefreq, priority }) => {
		const loc = absoluteUrl(path, origin);
		return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority.toFixed(1)}</priority>
  </url>`;
	}).join('\n');

	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>
`;
}
