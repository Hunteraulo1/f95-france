import { sql } from 'drizzle-orm';
import {
	boolean,
	integer,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	varchar
} from 'drizzle-orm/pg-core';

export const themeEnum = pgEnum('theme_enum', ['system', 'light', 'dark']);

export const user = pgTable('user', {
	id: varchar('id', { length: 255 }).primaryKey(),
	email: varchar('email', { length: 255 }).notNull().unique(),
	username: varchar('username', { length: 32 }).notNull().unique(),
	discordId: varchar('discord_id', { length: 255 }).unique(),
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
	profileBio: text('profile_bio'),
	profileBackgroundUrl: varchar('profile_background_url', { length: 2048 }),
	profileMusicUrl: varchar('profile_music_url', { length: 2048 }),
	profileCursorUrl: varchar('profile_cursor_url', { length: 2048 }),
	/** Presets de filtres de la page jeux (JSON sérialisé). */
	savedGamesFilters: text('saved_games_filters').notNull().default('[]'),
	/** Presets de filtres de la page mises à jour (JSON sérialisé). */
	savedUpdatesFilters: text('saved_updates_filters').notNull().default('[]'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const session = pgTable('session', {
	id: varchar('id', { length: 255 }).primaryKey(),
	secretHash: varchar('secret_hash', { length: 64 }).notNull(),
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

/** Clés d’accès pour l’API extension (hash SHA-256 du secret complet). */
export const apiKey = pgTable('api_key', {
	id: varchar('id', { length: 255 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	keyHash: varchar('key_hash', { length: 64 }).notNull().unique(),
	/** Préfixe affiché dans l’admin (début de la clé, sans révéler le secret). */
	keyPrefix: varchar('key_prefix', { length: 32 }).notNull(),
	label: varchar('label', { length: 255 }).notNull().default(''),
	/** `bearer` = clé secrète ; `session` = quota cookie (une ligne par compte, non utilisable comme Bearer). */
	kind: varchar('kind', { length: 16 }).notNull().default('bearer'),
	requestsPerMinute: integer('requests_per_minute').notNull().default(60),
	expiresAt: timestamp('expires_at'),
	revokedAt: timestamp('revoked_at'),
	lastUsedAt: timestamp('last_used_at'),
	/** Nombre total de requêtes /api/* comptabilisées après authentification (clé ou quota session). */
	totalRequestCount: integer('total_request_count').notNull().default(0),
	/** Compte auquel la clé appartient (quotas / révocation utilisateur). */
	ownerUserId: varchar('owner_user_id', { length: 255 })
		.notNull()
		.references(() => user.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	createdByUserId: varchar('created_by_user_id', { length: 255 }).references(() => user.id, {
		onDelete: 'set null',
		onUpdate: 'cascade'
	}),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

/** Fenêtre d’une minute pour le quota `requests_per_minute` par clé. */
export const apiKeyRate = pgTable('api_key_rate', {
	apiKeyId: varchar('api_key_id', { length: 255 })
		.primaryKey()
		.references(() => apiKey.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	requestCount: integer('request_count').notNull().default(0),
	windowStartedAt: timestamp('window_started_at').notNull().defaultNow()
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
	descriptionFr: text('description_fr'),
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
	/** Si false, le traducteur assigné ne reçoit plus d’alertes (auto-check, stats « pas à jour »). */
	translatorAlertsEnabled: boolean('translator_alerts_enabled').notNull().default(true),
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
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const config = pgTable('config', {
	id: varchar('id', { length: 255 }).primaryKey().default('main'),
	appName: varchar('app_name', { length: 255 }).notNull().default('F95 France'),
	/** Peut être surchargé par la variable d’environnement `GOOGLE_SPREADSHEET_ID`. */
	googleSpreadsheetId: varchar('google_spreadsheet_id', { length: 255 }),
	googleOAuthAccessToken: text('google_oauth_access_token'),
	googleOAuthRefreshToken: text('google_oauth_refresh_token'),
	googleOAuthTokenExpiry: timestamp('google_oauth_token_expiry'),
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
	openedByUserId: varchar('opened_by_user_id', { length: 255 }).references(() => user.id, {
		onDelete: 'set null'
	}),
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
	route: text('route').notNull(),
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

/** Rôle applicatif (slug = valeur de `user.role`). */
export const appRole = pgTable('app_role', {
	slug: varchar('slug', { length: 64 }).primaryKey(),
	label: varchar('label', { length: 255 }).notNull(),
	description: text('description'),
	/** direct | submission | user_direct_mode — voir `$lib/permissions/edit-mode`. */
	editMode: varchar('edit_mode', { length: 32 }).notNull().default('direct'),
	/** Style badge / pseudo — voir `$lib/permissions/role-badge-style`. */
	badgeStyle: varchar('badge_style', { length: 32 }).notNull().default('default'),
	/** Compte comme membre de l'équipe (affichage, modération, etc.). */
	staff: boolean('staff').notNull().default(false),
	/** Force / priorité d'affichage (tri staff et liste des rôles). Éditable par superadmin uniquement. */
	priority: integer('priority').notNull().default(0),
	isSystem: boolean('is_system').notNull().default(false),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const appPermission = pgTable('app_permission', {
	key: varchar('key', { length: 64 }).primaryKey(),
	label: varchar('label', { length: 255 }).notNull(),
	description: text('description'),
	group: varchar('group', { length: 64 })
});

export const appRolePermission = pgTable(
	'app_role_permission',
	{
		roleSlug: varchar('role_slug', { length: 64 })
			.notNull()
			.references(() => appRole.slug, { onDelete: 'cascade' }),
		permissionKey: varchar('permission_key', { length: 64 })
			.notNull()
			.references(() => appPermission.key, { onDelete: 'cascade' })
	},
	(t) => [primaryKey({ columns: [t.roleSlug, t.permissionKey] })]
);

/** Historique des changements sur une entrée `update` (statut, etc.). */
export const updateHistory = pgTable('update_history', {
	id: varchar('id', { length: 255 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	updateId: varchar('update_id', { length: 255 })
		.notNull()
		.references(() => update.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	userId: varchar('user_id', { length: 255 }).references(() => user.id, {
		onDelete: 'set null',
		onUpdate: 'cascade'
	}),
	/** `created` | `status_changed` | `deleted` */
	action: varchar('action', { length: 32 }).notNull(),
	/** Delta JSON (ex. `{ "field": "status", "oldValue": "update", "newValue": "done" }`). */
	changes: text('changes'),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

export type UpdateHistory = typeof updateHistory.$inferSelect;
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
export type ApiKey = typeof apiKey.$inferSelect;
export type ApiKeyRate = typeof apiKeyRate.$inferSelect;
export type AppRole = typeof appRole.$inferSelect;
export type AppPermission = typeof appPermission.$inferSelect;
