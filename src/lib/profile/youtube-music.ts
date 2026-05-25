import { normalizeOptionalMediaUrl } from '$lib/profile/custom-profile';

const VIDEO_ID_RE = /^[\w-]{11}$/;

/** Extrait l’identifiant vidéo depuis une URL YouTube ou YouTube Music. */
export function extractYoutubeVideoId(raw: string | null | undefined): string | null {
	const trimmed = String(raw ?? '').trim();
	if (!trimmed) return null;

	try {
		const url = new URL(trimmed);
		const host = url.hostname.toLowerCase().replace(/^www\./, '');

		if (host === 'youtu.be') {
			const id = url.pathname.replace(/^\//, '').split('/')[0] ?? '';
			return VIDEO_ID_RE.test(id) ? id : null;
		}

		const allowedHosts = new Set([
			'youtube.com',
			'm.youtube.com',
			'music.youtube.com',
			'youtube-nocookie.com'
		]);
		if (!allowedHosts.has(host)) return null;

		const embedMatch = url.pathname.match(/\/embed\/([\w-]{11})/);
		if (embedMatch?.[1]) return embedMatch[1];

		const v = url.searchParams.get('v') ?? url.searchParams.get('vi');
		if (v && VIDEO_ID_RE.test(v)) return v;

		// music.youtube.com/watch/VIDEO_ID (format parfois partagé)
		const watchPath = url.pathname.match(/^\/watch\/([\w-]{11})$/);
		if (watchPath?.[1]) return watchPath[1];

		return null;
	} catch {
		return null;
	}
}

/** URL canonique stockée en base (toujours youtube.com/watch). */
export function canonicalYoutubeWatchUrl(videoId: string): string {
	return `https://www.youtube.com/watch?v=${videoId}`;
}

export function youtubeMusicEmbedUrl(videoId: string): string {
	return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`;
}

export function youtubeMusicEmbedFromUrl(storedUrl: string | null | undefined): string | null {
	const id = extractYoutubeVideoId(storedUrl);
	return id ? youtubeMusicEmbedUrl(id) : null;
}

export function validateOptionalYoutubeMusicUrl(
	raw: string | null | undefined
): string | null | { error: string } {
	const value = normalizeOptionalMediaUrl(raw);
	if (!value) return null;

	const id = extractYoutubeVideoId(value);
	if (!id) {
		return {
			error:
				'Musique : lien YouTube ou YouTube Music invalide (ex. https://music.youtube.com/watch?v=… ou https://youtu.be/…)'
		};
	}

	return canonicalYoutubeWatchUrl(id);
}
