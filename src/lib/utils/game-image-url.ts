/** Hôtes F95 pour lesquels on force https (contenu mixte bloqué en prod sur pages HTTPS). */
function isF95Host(hostname: string): boolean {
	return hostname === 'f95zone.to' || hostname.endsWith('.f95zone.to');
}

/**
 * URL utilisable en `src` pour une vignette jeu : absolue, HTTPS quand c’est possible,
 * chemins relatifs XenForo résolus sur f95zone.to (sinon le navigateur les charge sur le domaine Vercel).
 */
export function resolveGameImageSrc(
	raw: string | null | undefined,
	opts?: { website?: string | null }
): string {
	const u = (raw ?? '').trim();
	if (!u) return '';

	if (u.startsWith('//')) {
		return `https:${u}`;
	}

	if (u.startsWith('/') && !u.startsWith('//')) {
		const site = opts?.website ?? 'f95z';
		if (site === 'f95z') {
			return `https://f95zone.to${u}`;
		}
		return u;
	}

	if (u.startsWith('http://')) {
		try {
			const { hostname } = new URL(u);
			if (isF95Host(hostname)) {
				return `https://${u.slice('http://'.length)}`;
			}
		} catch {
			/* ignore */
		}
	}

	return u;
}
