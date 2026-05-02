import type { Game, GameTranslation, User as UserType } from './server/db/schema';

export type GameEngineType = GameTranslation['gameType'];

export type FormGameType = Game & GameTranslation;

export type PublicUser = Omit<
	UserType,
	'passwordHash' | 'twoFactorSecret' | 'twoFactorEnabled' | 'theme' | 'devUserId' | 'email'
>;

