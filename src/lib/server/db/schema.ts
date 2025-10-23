import { sql } from 'drizzle-orm';
import { boolean, datetime, int, mysqlEnum, mysqlTable, text, varchar } from 'drizzle-orm/mysql-core';

export const user = mysqlTable('user', {
	id: varchar('id', { length: 255 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
	username: varchar('username', { length: 32 }).notNull().unique(),
  avatar: varchar('avatar', { length: 255 }).notNull(),
	passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 255 }).notNull().default('user'),
  theme: mysqlEnum('theme', ['light', 'dark']).notNull().default('light'),
  devUserId: varchar('dev_user_id', { length: 255 }),
  gameAdd: int('game_add').notNull().default(0),
  gameEdit: int('game_edit').notNull().default(0),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});

export const session = mysqlTable('session', {
	id: varchar('id', { length: 255 }).primaryKey(),
	userId: varchar('user_id', { length: 255 })
		.notNull()
		.references(() => user.id),
	expiresAt: datetime('expires_at').notNull()
});

export const games = mysqlTable('games', {
	id: varchar('id', { length: 255 }).primaryKey().default(sql`(UUID())`),
	name: varchar('name', { length: 255 }).notNull(),
	tags: text('tags').notNull(),
	type: text('type').notNull(),
	image: varchar('image', { length: 500 }).notNull(),
	createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
	updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
	description: text('description'),
	website: mysqlEnum('website', ['f95z', 'lc', 'other']).notNull().default('f95z'),
	threadId: int('thread_id'),
	link: varchar('link', { length: 500 }).notNull().default('')
});

export const gameTranslations = mysqlTable('game_translations', {
	id: varchar('id', { length: 255 }).primaryKey().default(sql`(UUID())`),
	gameId: varchar('game_id', { length: 255 })
		.notNull()
		.references(() => games.id),
  translationName: varchar('translation_name', { length: 255 }),
	status: mysqlEnum('status', ['in_progress', 'completed', 'abandoned']).notNull(),
	version: varchar('version', { length: 100 }).notNull(),
	tversion: varchar('tversion', { length: 100 }).notNull(),
	tlink: text('tlink').notNull(),
	traductorId: varchar('traductor_id', { length: 255 }),
	proofreaderId: varchar('proofreader_id', { length: 255 }),
	ttype: mysqlEnum('ttype', ['auto', 'vf', 'manual', 'semi-auto', 'to_tested', 'hs']).notNull(),
	ac: boolean('ac').notNull().default(false),
	createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
	updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`)
});

export const updates = mysqlTable('updates', {
	id: varchar('id', { length: 255 }).primaryKey().default(sql`(UUID())`),
	gameId: varchar('game_id', { length: 255 })
		.notNull()
		.references(() => games.id),
	createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
	updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`)
});

export const traductors = mysqlTable('traductors', {
	id: varchar('id', { length: 255 }).primaryKey().default(sql`(UUID())`),
	name: varchar('name', { length: 255 }).notNull().unique(),
	userId: varchar('user_id', { length: 255 })
		.references(() => user.id),
	pages: text('pages').notNull(),
	discordId: varchar('discord_id', { length: 255 }).unique(),
	tradCount: int('trad_count').notNull().default(0),
	readCount: int('read_count').notNull().default(0),
	createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
	updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`)
});


export type Session = typeof session.$inferSelect;
export type User = typeof user.$inferSelect;
export type Games = typeof games.$inferSelect;
export type GameTranslations = typeof gameTranslations.$inferSelect;
export type Updates = typeof updates.$inferSelect;
export type Traductors = typeof traductors.$inferSelect;
