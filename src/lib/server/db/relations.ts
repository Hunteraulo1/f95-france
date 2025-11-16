import { relations } from "drizzle-orm/relations";
import { game, gameTranslation, session, translator, update, user } from "./schema";

export const gameTranslationRelations = relations(gameTranslation, ({one}) => ({
	game: one(game, {
		fields: [gameTranslation.gameId],
		references: [game.id]
	}),
}));

export const gamesRelations = relations(game, ({many}) => ({
	gameTranslations: many(gameTranslation),
	updates: many(update),
}));

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));

export const userRelations = relations(user, ({many}) => ({
	sessions: many(session),
	translators: many(translator),
}));

export const translatorRelations = relations(translator, ({one}) => ({
	user: one(user, {
		fields: [translator.userId],
		references: [user.id]
	}),
}));

export const updatesRelations = relations(update, ({one}) => ({
	game: one(game, {
		fields: [update.gameId],
		references: [game.id]
	}),
}));
