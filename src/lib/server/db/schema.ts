import { sql } from 'drizzle-orm';
import { boolean, integer, pgEnum, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const themeEnum = pgEnum('theme_enum', ['system', 'light', 'dark']);

export const user = pgTable('user', {
	id: varchar('id', { length: 255 }).primaryKey(),
	email: varchar('email', { length: 255 }).notNull().unique(),
	username: varchar('username', { length: 32 }).notNull().unique(),
	avatar: varchar('avatar', { length: 255 }).notNull(),
	passwordHash: varchar('password_hash', { length: 255 }).notNull(),
	twoFactorEnabled: boolean('two_factor_enabled').notNull().default(false),
	twoFactorSecret: text('two_factor_secret'),
	role: varchar('role', { length: 255 }).notNull().default('user'),
	theme: themeEnum('theme').default('system'),
	directMode: boolean('direct_mode').notNull().default(true),
	devUserId: varchar('dev_user_id', { length: 255 }),
	gameAdd: integer('game_add').notNull().default(0),
	gameEdit: integer('game_edit').notNull().default(0),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const session = pgTable('session', {
	id: varchar('id', { length: 255 }).primaryKey(),
	userId: varchar('user_id', { length: 255 })
		.notNull()
		.references(() => user.id),
	expiresAt: timestamp('expires_at').notNull()
});

export const passkey = pgTable('passkey', {
	id: varchar('id', { length: 255 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	userId: varchar('user_id', { length: 255 })
		.notNull()
		.references(() => user.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	credentialId: text('credential_id').notNull().unique(),
	publicKey: text('public_key').notNull(),
	counter: integer('counter').notNull().default(0),
	transports: text('transports'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	lastUsedAt: timestamp('last_used_at')
});

export const passkeyChallenge = pgTable('passkey_challenge', {
	id: varchar('id', { length: 255 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	userId: varchar('user_id', { length: 255 }).references(() => user.id, {
		onDelete: 'cascade',
		onUpdate: 'cascade'
	}),
	type: varchar('type', { length: 32 }).notNull(), // register | login
	challenge: text('challenge').notNull(),
	expiresAt: timestamp('expires_at').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

/** Compteur d’échecs de connexion par IP (anti-bruteforce côté app). */
export const loginThrottle = pgTable('login_throttle', {
	clientKey: varchar('client_key', { length: 128 }).primaryKey(),
	failedCount: integer('failed_count').notNull().default(0),
	windowStartedAt: timestamp('window_started_at').notNull().defaultNow(),
	lockedUntil: timestamp('locked_until')
});

export const game = pgTable('game', {
	id: varchar('id', { length: 255 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	name: varchar('name', { length: 255 }).notNull(),
	tags: text('tags').notNull(),
	image: varchar('image', { length: 500 }).notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
	description: text('description'),
	website: varchar('website', { length: 32 }).notNull().default('f95z'),
	threadId: integer('thread_id'),
	link: varchar('link', { length: 500 }).notNull().default(''),
	/** Si false, aucune traduction ne peut avoir l’Auto-Check */
	gameAutoCheck: boolean('game_auto_check').notNull().default(true),
	gameVersion: varchar('game_version', { length: 100 })
});

export const gameTranslation = pgTable('game_translation', {
	id: varchar('id', { length: 255 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	gameId: varchar('game_id', { length: 255 })
		.notNull()
		.references(() => game.id),
	translationName: varchar('translation_name', { length: 255 }),
	version: varchar('version', { length: 100 }),
	status: varchar('status', { length: 32 }).notNull(),
	tversion: varchar('tversion', { length: 100 }).notNull(),
	tlink: text('tlink').notNull(),
	tname: varchar('tname', { length: 64 }).notNull().default('no_translation'),
	translatorId: varchar('traductor_id', { length: 255 }),
	proofreaderId: varchar('proofreader_id', { length: 255 }),
	ttype: varchar('ttype', { length: 32 }).notNull(),
	/** Moteur / technologie du jeu (RenPy, Unity, HTML, etc.) — par traduction. */
	gameType: varchar('game_type', { length: 32 }).notNull().default('other'),
	ac: boolean('ac').notNull().default(false),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const update = pgTable('update', {
	id: varchar('id', { length: 255 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	gameId: varchar('game_id', { length: 255 })
		.notNull()
		.references(() => game.id),
	status: varchar('status', { length: 16 }).notNull().default('update'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const translator = pgTable('translator', {
	id: varchar('id', { length: 255 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	name: varchar('name', { length: 255 }).notNull().unique(),
	userId: varchar('user_id', { length: 255 }).references(() => user.id),
	pages: text('pages').notNull(),
	discordId: varchar('discord_id', { length: 255 }).unique(),
	tradCount: integer('trad_count').notNull().default(0),
	readCount: integer('read_count').notNull().default(0),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const config = pgTable('config', {
	id: varchar('id', { length: 255 }).primaryKey().default('main'),
	appName: varchar('app_name', { length: 255 }).notNull().default('F95 France'),
	discordWebhookUpdates: text('discord_webhook_updates'),
	discordWebhookLogs: text('discord_webhook_logs'),
	discordWebhookTranslators: text('discord_webhook_translators'),
	discordWebhookProofreaders: text('discord_webhook_proofreaders'),
	googleSpreadsheetId: varchar('google_spreadsheet_id', { length: 255 }),
	googleApiKey: text('google_api_key'),
	googleOAuthClientId: text('google_oauth_client_id'),
	googleOAuthClientSecret: text('google_oauth_client_secret'),
	googleOAuthAccessToken: text('google_oauth_access_token'),
	googleOAuthRefreshToken: text('google_oauth_refresh_token'),
	googleOAuthTokenExpiry: timestamp('google_oauth_token_expiry'),
	autoCheckIntervalMinutes: integer('auto_check_interval_minutes').notNull().default(360),
	autoCheckReferenceTime: varchar('auto_check_reference_time', { length: 5 })
		.notNull()
		.default('00:00'),
	autoCheckLastRunAt: timestamp('auto_check_last_run_at'),
	maintenanceMode: boolean('maintenance_mode').notNull().default(false),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const submission = pgTable('submission', {
	id: varchar('id', { length: 255 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	userId: varchar('user_id', { length: 255 })
		.notNull()
		.references(() => user.id),
	status: varchar('status', { length: 32 }).notNull().default('pending'),
	gameId: varchar('game_id', { length: 255 }).references(() => game.id),
	translationId: varchar('translation_id', { length: 255 }).references(() => gameTranslation.id),
	type: varchar('type', { length: 32 }).notNull(),
	data: text('data').notNull(), // JSON data for the submission
	adminNotes: text('admin_notes'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const apiLog = pgTable('api_log', {
	id: varchar('id', { length: 255 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	userId: varchar('user_id', { length: 255 }).references(() => user.id, {
		onDelete: 'set null',
		onUpdate: 'cascade'
	}),
	method: varchar('method', { length: 16 }).notNull(),
	route: varchar('route', { length: 255 }).notNull(),
	status: integer('status').notNull(),
	ipAddress: varchar('ip_address', { length: 64 }),
	payload: text('payload'),
	errorMessage: text('error_message'),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

export const notification = pgTable('notification', {
	id: varchar('id', { length: 255 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	userId: varchar('user_id', { length: 255 })
		.notNull()
		.references(() => user.id, {
			onDelete: 'cascade',
			onUpdate: 'cascade'
		}),
	type: varchar('type', { length: 64 }).notNull(),
	title: varchar('title', { length: 255 }).notNull(),
	message: text('message').notNull(),
	read: boolean('read').notNull().default(false),
	link: varchar('link', { length: 500 }),
	metadata: text('metadata'), // JSON pour stocker des données supplémentaires
	createdAt: timestamp('created_at').notNull().defaultNow()
});

export type Session = typeof session.$inferSelect;
export type User = typeof user.$inferSelect;
export type Passkey = typeof passkey.$inferSelect;
export type PasskeyChallenge = typeof passkeyChallenge.$inferSelect;
export type Game = typeof game.$inferSelect;
export type GameTranslation = typeof gameTranslation.$inferSelect;
export type Update = typeof update.$inferSelect;
export type Translator = typeof translator.$inferSelect;
export type Config = typeof config.$inferSelect;
export type Submission = typeof submission.$inferSelect;
export type ApiLog = typeof apiLog.$inferSelect;
export type Notification = typeof notification.$inferSelect;
