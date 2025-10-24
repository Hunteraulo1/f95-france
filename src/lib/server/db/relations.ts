import { relations } from "drizzle-orm/relations";
import { gameTranslations, games, session, traductors, updates, user } from "./schema";

export const gameTranslationsRelations = relations(gameTranslations, ({one}) => ({
	game: one(games, {
		fields: [gameTranslations.gameId],
		references: [games.id]
	}),
}));

export const gamesRelations = relations(games, ({many}) => ({
	gameTranslations: many(gameTranslations),
	updates: many(updates),
}));

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));

export const userRelations = relations(user, ({many}) => ({
	sessions: many(session),
	traductors: many(traductors),
}));

export const traductorsRelations = relations(traductors, ({one}) => ({
	user: one(user, {
		fields: [traductors.userId],
		references: [user.id]
	}),
}));

export const updatesRelations = relations(updates, ({one}) => ({
	game: one(games, {
		fields: [updates.gameId],
		references: [games.id]
	}),
}));
