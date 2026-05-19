/** Hôtes F95 pour lesquels on force https (contenu mixte bloqué en prod sur pages HTTPS). */
function isF95Host(hostname: string): boolean {
	return hostname === 'f95zone.to' || hostname.endsWith('.f95zone.to');
}

function isLcHost(hostname: string): boolean {
	return hostname === 'lewdcorner.com' || hostname.endsWith('.lewdcorner.com');
}

/** Hôtes qui servent des pages HTML de galerie, pas un fichier image (ORB / `<img>` cassé). */
const GALLERY_PAGE_HOSTS = new Set([
	'ibb.co',
	'www.ibb.co',
	'postimg.cc',
	'www.postimg.cc',
	'imgur.com',
	'www.imgur.com'
]);

function parseHttpUrl(raw: string): URL | null {
	const u = raw.trim();
	if (!u) return null;
	try {
		return new URL(u.startsWith('//') ? `https:${u}` : u);
	} catch {
		return null;
	}
}

/**
 * Lien de page galerie (ex. `https://ibb.co/gZnFv949`) — à ne pas utiliser en `src` d’une vignette.
 * Préférer l’URL directe (ex. `https://i.ibb.co/.../....png`).
 */
export function isGameImageGalleryPageUrl(raw: string | null | undefined): boolean {
	const parsed = parseHttpUrl(raw ?? '');
	if (!parsed || (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')) return false;
	return GALLERY_PAGE_HOSTS.has(parsed.hostname.toLowerCase());
}

/**
 * URL utilisable en `src` pour une vignette jeu : absolue, HTTPS quand c’est possible,
 * chemins relatifs XenForo résolus sur f95zone.to (sinon le navigateur les charge sur le domaine Vercel).
 * Retourne une chaîne vide si l’URL est une page galerie ou invalide pour `<img>`.
 */
export function resolveGameImageSrc(
	raw: string | null | undefined,
	opts?: { website?: string | null }
): string {
	const u = (raw ?? '').trim();
	if (!u) return '';

	if (u.startsWith('//')) {
		const resolved = `https:${u}`;
		return isGameImageGalleryPageUrl(resolved) ? '' : resolved;
	}

	if (u.startsWith('/') && !u.startsWith('//')) {
		const site = opts?.website ?? 'f95z';
		if (site === 'f95z') {
			return `https://f95zone.to${u}`;
		}
		if (site === 'lc') {
			return `https://lewdcorner.com${u}`;
		}
		return u;
	}

	if (u.startsWith('http://')) {
		try {
			const { hostname } = new URL(u);
			if (isF95Host(hostname) || isLcHost(hostname)) {
				const resolved = `https://${u.slice('http://'.length)}`;
				return isGameImageGalleryPageUrl(resolved) ? '' : resolved;
			}
		} catch {
			/* ignore */
		}
	}

	if (isGameImageGalleryPageUrl(u)) return '';

	return u;
}
