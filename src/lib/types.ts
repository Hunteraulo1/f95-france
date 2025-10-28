import type { Game, GameTranslation, User as UserType } from './server/db/schema';

export type FormGameType = Game & GameTranslation;

export type PublicUser = Omit<UserType, 'passwordHash' | 'theme' | 'devUserId' | 'email'>;
