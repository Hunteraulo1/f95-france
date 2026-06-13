import { absoluteUrl, siteOrigin } from '$lib/site';

const SITEMAP_BASE_PATHS = [
	{ path: '/', changefreq: 'weekly' as const, priority: 1 },
	{ path: '/legals/legal-notice', changefreq: 'monthly' as const, priority: 0.3 },
	{ path: '/legals/privacy-policy', changefreq: 'monthly' as const, priority: 0.3 },
	{ path: '/dashboard/account/login', changefreq: 'monthly' as const, priority: 0.4 }
] as const;

const SITEMAP_REGISTER_PATH = {
	path: '/dashboard/account/register',
	changefreq: 'monthly' as const,
	priority: 0.4
} as const;

/** Pages accessibles sans authentification (indexables). */
export const SITEMAP_PUBLIC_PATHS = [...SITEMAP_BASE_PATHS, SITEMAP_REGISTER_PATH] as const;

export function getSitemapPublicPaths(registrationEnabled = true) {
	if (registrationEnabled) {
		return SITEMAP_PUBLIC_PATHS;
	}
	return SITEMAP_BASE_PATHS;
}

function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/** Génère un document sitemap.xml (schéma sitemaps.org 0.9). */
export function buildSitemapXml(
	publicOrigin?: string | null,
	options?: { registrationEnabled?: boolean }
): string {
	const origin = siteOrigin(publicOrigin);
	const lastmod = new Date().toISOString().slice(0, 10);
	const paths = getSitemapPublicPaths(options?.registrationEnabled ?? true);

	const urlEntries = paths
		.map(({ path, changefreq, priority }) => {
			const loc = absoluteUrl(path, origin);
			return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority.toFixed(1)}</priority>
  </url>`;
		})
		.join('\n');

	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>
`;
}
