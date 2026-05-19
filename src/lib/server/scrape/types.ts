import type { GameEngineType } from '$lib/types';

export interface ScrapedThreadGame {
	name: string | null;
	version: string | null;
	description: string | null;
	status: string | null;
	tags: string | null;
	gameType: GameEngineType | null;
	image: string | null;
}
