/** Métadonnées publiques du site (SEO, Open Graph, security.txt). */
export const SITE = {
	name: 'F95 France',
	description:
		'Plateforme de gestion des traductions françaises pour la communauté F95 — soumissions, traducteurs et suivi des jeux.',
	defaultOrigin: 'https://f95france.site',
	/** Serveur Discord communautaire (lien d’invitation ou redirect). */
	discordInviteUrl: 'https://discord.f95france.site',
	/** Documentation et guides communautaires. */
	wikiUrl: 'https://wiki.f95france.site',
	/** Page de téléchargement de l’extension navigateur (releases GitHub). */
	extensionDownloadUrl: 'https://extension.f95france.site',
	/** Image Open Graph (chemin absolu sur le domaine, min. recommandé 1200×630 pour les réseaux). */
	ogImagePath: '/opengraph.svg',
	defaultSecurityContact: 'mailto:security@f95france.site'
} as const;

export function siteOrigin(publicOrigin?: string | null): string {
	const trimmed = publicOrigin?.trim();
	if (trimmed) {
		try {
			return new URL(trimmed).origin;
		} catch {
			/* ignore */
		}
	}
	return SITE.defaultOrigin;
}

export function absoluteUrl(path: string, publicOrigin?: string | null): string {
	const origin = siteOrigin(publicOrigin);
	return new URL(path.startsWith('/') ? path : `/${path}`, origin).href;
}
