import type { Game, GameTranslation } from './server/db/schema';

export type GameEngineType = GameTranslation['gameType'];

export type FormGameType = Game & GameTranslation;
