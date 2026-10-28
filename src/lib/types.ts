import type { Game, GameTranslation } from './server/db/schema';

export type GameEngineType = GameTranslation['gameType'];

// `f95LastChange` est interne à l’auto-check : jamais saisi ni affiché dans les formulaires.
export type FormGameType = Omit<Game, 'f95LastChange'> & GameTranslation;
