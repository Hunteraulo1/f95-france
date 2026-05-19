export type GameThreadLinkInput = {
	link?: string | null;
	threadId?: number | null;
	website?: string | null;
};

/** URL du fil du jeu : champ `link`, ou dérivée de `threadId` + site. */
export function resolveGameThreadLink(game: GameThreadLinkInput): string | null {
	const direct = (game.link ?? '').trim();
	if (direct) return direct;
	const tid = game.threadId;
	if (tid == null || tid === 0) return null;
	switch ((game.website ?? '').trim().toLowerCase()) {
		case 'f95z':
			return `https://f95zone.to/threads/${tid}`;
		case 'lc':
			return `https://lewdcorner.com/threads/${tid}`;
		default:
			return null;
	}
}
