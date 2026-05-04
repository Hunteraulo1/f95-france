/** Ligne issue du join update + game (+ engines) pour construire l’objet `game` enrichi. */
export type UpdateJoinGameRow = {
	gameId: string;
	gameName: string;
	gameImage: string;
	gameLink: string;
	gameWebsite: string;
	gameThreadId: number | null;
	gameGameVersion: string | null;
	gameEngineTypes: unknown;
	gameTags: string;
};

export function embeddedGameFromRow(r: UpdateJoinGameRow) {
	const engineTypes = Array.isArray(r.gameEngineTypes) ? r.gameEngineTypes : [];
	return {
		id: r.gameId,
		name: r.gameName,
		image: r.gameImage,
		link: r.gameLink,
		website: r.gameWebsite,
		threadId: r.gameThreadId,
		gameVersion: r.gameGameVersion,
		type: engineTypes[0] ?? 'other',
		engineTypes,
		tags: r.gameTags
	};
}
