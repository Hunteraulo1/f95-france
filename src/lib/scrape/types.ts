import type { GameEngineType } from '$lib/types';

/** Données extraites d’un thread F95 / LC (partagé client / serveur). */
export interface ScrapedThreadGame {
	name: string | null;
	version: string | null;
	description: string | null;
	status: string | null;
	tags: string | null;
	gameType: GameEngineType | null;
	image: string | null;
}
