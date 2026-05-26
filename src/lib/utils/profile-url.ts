/** Segment d’URL du profil public (pseudo encodé). */
export function profileDashboardSlug(username: string): string {
	return encodeURIComponent(username.trim());
}

/** Chemin du profil public dashboard (`/dashboard/profile/{pseudo}`). */
export function profileDashboardHref(username: string): `/dashboard/profile/${string}` {
	return `/dashboard/profile/${profileDashboardSlug(username)}`;
}
