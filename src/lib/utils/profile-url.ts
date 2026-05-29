/** Segment d’URL du profil public (pseudo encodé). */
export function profilePublicSlug(username: string): string {
	return encodeURIComponent(username.trim());
}

/** Chemin du profil public (`/profile/{pseudo}`). */
export function profilePublicHref(username: string): `/profile/${string}` {
	return `/profile/${profilePublicSlug(username)}`;
}

/** Chemin du profil dans le dashboard (`/dashboard/profile/{pseudo}`). */
export function profileDashboardHref(username: string): `/dashboard/profile/${string}` {
	return `/dashboard/profile/${profilePublicSlug(username)}`;
}
