export function isDevHost(hostname: string): boolean {
	return hostname === 'localhost' || hostname === '127.0.0.1';
}

export function isPtbHost(hostname: string): boolean {
	return hostname === 'ptb.f95france.site';
}

export type SiteEnvBadge = {
	label: 'DEV' | 'PTB';
	background: string;
	foreground: string;
};

export function resolveSiteEnvBadge(hostname: string): SiteEnvBadge | null {
	if (isDevHost(hostname)) {
		return { label: 'DEV', background: '#38bdf8', foreground: '#0c4a6e' };
	}
	if (isPtbHost(hostname)) {
		return { label: 'PTB', background: '#facc15', foreground: '#713f12' };
	}
	return null;
}
