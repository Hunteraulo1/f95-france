import { sql } from 'drizzle-orm';
import {
	boolean,
	datetime,
	index,
	int,
	mysqlEnum,
	mysqlTable,
	primaryKey,
	text,
	varchar
} from 'drizzle-orm/mysql-core';

export const user = mysqlTable('user', {
	id: varchar('id', { length: 255 }).primaryKey(),
	email: varchar('email', { length: 255 }).notNull().unique(),
	username: varchar('username', { length: 32 }).notNull().unique(),
	discordId: varchar('discord_id', { length: 255 }).unique(),
	avatar: varchar('avatar', { length: 255 }).notNull(),
	passwordHash: varchar('password_hash', { length: 255 }).notNull(),
	hasPassword: boolean('has_password').notNull().default(true),
	twoFactorEnabled: boolean('two_factor_enabled').notNull().default(false),
	twoFactorSecret: text('two_factor_secret'),
	role: varchar('role', { length: 255 }).notNull().default('user'),
	theme: mysqlEnum('theme', ['system', 'light', 'dark']).default('system'),
	directMode: boolean('direct_mode').notNull().default(true),
	devUserId: varchar('dev_user_id', { length: 255 }),
	gameAdd: int('game_add').notNull().default(0),
	gameEdit: int('game_edit').notNull().default(0),
	profileBio: text('profile_bio'),
	profileBackgroundUrl: varchar('profile_background_url', { length: 2048 }),
	profileMusicUrl: varchar('profile_music_url', { length: 2048 }),
	profileCursorUrl: varchar('profile_cursor_url', { length: 2048 }),
	savedGamesFilters: text('saved_games_filters').notNull().default('[]'),
	savedUpdatesFilters: text('saved_updates_filters').notNull().default('[]'),
	emailVerifiedAt: datetime('email_verified_at'),
	emailUnsubscribeToken: varchar('email_unsubscribe_token', { length: 64 }).notNull().unique(),
	emailMarketingOptOut: boolean('email_marketing_opt_out').notNull().default(false),
	lastSeenAt: datetime('last_seen_at'),
	createdAt: datetime('created_at')
		.notNull()
		.default(sql`(NOW())`),
	updatedAt: datetime('updated_at')
		.notNull()
		.default(sql`(NOW())`)
});

export const emailVerificationToken = mysqlTable('email_verification_token', {
	id: varchar('id', { length: 255 })
		.primaryKey()
		.default(sql`(UUID())`),
	userId: varchar('user_id', { length: 255 })
		.notNull()
		.references(() => user.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	tokenHash: varchar('token_hash', { length: 64 }).notNull(),
	expiresAt: datetime('expires_at').notNull(),
	createdAt: datetime('created_at')
		.notNull()
		.default(sql`(NOW())`)
});

export const passwordResetToken = mysqlTable('password_reset_token', {
	id: varchar('id', { length: 255 })
		.primaryKey()
		.default(sql`(UUID())`),
	userId: varchar('user_id', { length: 255 })
		.notNull()
		.references(() => user.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	tokenHash: varchar('token_hash', { length: 64 }).notNull(),
	expiresAt: datetime('expires_at').notNull(),
	createdAt: datetime('created_at')
		.notNull()
		.default(sql`(NOW())`)
});

export const session = mysqlTable('session', {
	id: varchar('id', { length: 255 }).primaryKey(),
	secretHash: varchar('secret_hash', { length: 64 }).notNull(),
	userId: varchar('user_id', { length: 255 })
		.notNull()
		.references(() => user.id),
	expiresAt: datetime('expires_at').notNull()
});

export const passkey = mysqlTable('passkey', {
	id: varchar('id', { length: 255 })
		.primaryKey()
		.default(sql`(UUID())`),
	userId: varchar('user_id', { length: 255 })
		.notNull()
		.references(() => user.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	credentialId: text('credential_id').notNull(),
	publicKey: text('public_key').notNull(),
	counter: int('counter').notNull().default(0),
	transports: text('transports'),
	createdAt: datetime('created_at')
		.notNull()
		.default(sql`(NOW())`),
	lastUsedAt: datetime('last_used_at')
});

export const passkeyChallenge = mysqlTable('passkey_challenge', {
	id: varchar('id', { length: 255 })
		.primaryKey()
		.default(sql`(UUID())`),
	userId: varchar('user_id', { length: 255 }).references(() => user.id, {
		onDelete: 'cascade',
		onUpdate: 'cascade'
	}),
	type: varchar('type', { length: 32 }).notNull(),
	challenge: text('challenge').notNull(),
	expiresAt: datetime('expires_at').notNull(),
	createdAt: datetime('created_at')
		.notNull()
		.default(sql`(NOW())`)
});

export const loginThrottle = mysqlTable('login_throttle', {
	clientKey: varchar('client_key', { length: 128 }).primaryKey(),
	failedCount: int('failed_count').notNull().default(0),
	windowStartedAt: datetime('window_started_at')
		.notNull()
		.default(sql`(NOW())`),
	lockedUntil: datetime('locked_until')
});

export const apiKey = mysqlTable('api_key', {
	id: varchar('id', { length: 255 })
		.primaryKey()
		.default(sql`(UUID())`),
	keyHash: varchar('key_hash', { length: 64 }).notNull().unique(),
	keyPrefix: varchar('key_prefix', { length: 32 }).notNull(),
	label: varchar('label', { length: 255 }).notNull().default(''),
	kind: varchar('kind', { length: 16 }).notNull().default('bearer'),
	// Restreint la clé à un préfixe de route (ex. clé d’extension). NULL = accès complet.
	routeScope: varchar('route_scope', { length: 64 }),
	requestsPerMinute: int('requests_per_minute').notNull().default(30),
	expiresAt: datetime('expires_at'),
	revokedAt: datetime('revoked_at'),
	lastUsedAt: datetime('last_used_at'),
	totalRequestCount: int('total_request_count').notNull().default(0),
	ownerUserId: varchar('owner_user_id', { length: 255 })
		.notNull()
		.references(() => user.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	createdByUserId: varchar('created_by_user_id', { length: 255 }).references(() => user.id, {
		onDelete: 'set null',
		onUpdate: 'cascade'
	}),
	createdAt: datetime('created_at')
		.notNull()
		.default(sql`(NOW())`),
	updatedAt: datetime('updated_at')
		.notNull()
		.default(sql`(NOW())`)
});

export const apiKeyRate = mysqlTable('api_key_rate', {
	apiKeyId: varchar('api_key_id', { length: 255 })
		.primaryKey()
		.references(() => apiKey.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	requestCount: int('request_count').notNull().default(0),
	windowStartedAt: datetime('window_started_at')
		.notNull()
		.default(sql`(NOW())`)
});

export const extensionLinkCode = mysqlTable('extension_link_code', {
	code: varchar('code', { length: 16 }).primaryKey(),
	userId: varchar('user_id', { length: 255 })
		.notNull()
		.references(() => user.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	expiresAt: datetime('expires_at').notNull(),
	usedAt: datetime('used_at'),
	createdAt: datetime('created_at')
		.notNull()
		.default(sql`(NOW())`)
});

export const game = mysqlTable('game', {
	id: varchar('id', { length: 255 })
		.primaryKey()
		.default(sql`(UUID())`),
	name: varchar('name', { length: 255 }).notNull(),
	tags: text('tags').notNull(),
	image: varchar('image', { length: 500 }).notNull(),
	createdAt: datetime('created_at')
		.notNull()
		.default(sql`(NOW())`),
	updatedAt: datetime('updated_at')
		.notNull()
		.default(sql`(NOW())`),
	description: text('description'),
	descriptionFr: text('description_fr'),
	website: varchar('website', { length: 32 }).notNull().default('f95z'),
	threadId: int('thread_id'),
	link: varchar('link', { length: 500 }).notNull().default(''),
	gameAutoCheck: boolean('game_auto_check').notNull().default(true),
	gameVersion: varchar('game_version', { length: 100 })
});

export const gameTranslation = mysqlTable('game_translation', {
	id: varchar('id', { length: 255 })
		.primaryKey()
		.default(sql`(UUID())`),
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
	translatorAlertsEnabled: boolean('translator_alerts_enabled').notNull().default(true),
	proofreaderId: varchar('proofreader_id', { length: 255 }),
	ttype: varchar('ttype', { length: 32 }).notNull(),
	gameType: varchar('game_type', { length: 32 }).notNull().default('other'),
	ac: boolean('ac').notNull().default(false),
	createdAt: datetime('created_at')
		.notNull()
		.default(sql`(NOW())`),
	updatedAt: datetime('updated_at')
		.notNull()
		.default(sql`(NOW())`)
});

export const update = mysqlTable('update', {
	id: varchar('id', { length: 255 })
		.primaryKey()
		.default(sql`(UUID())`),
	gameId: varchar('game_id', { length: 255 })
		.notNull()
		.references(() => game.id),
	// Traduction à l'origine de la MAJ. NULL = legacy / MAJ jeu sans trad ciblée.
	translationId: varchar('translation_id', { length: 255 }).references(() => gameTranslation.id, {
		onDelete: 'set null'
	}),
	status: varchar('status', { length: 16 }).notNull().default('update'),
	createdAt: datetime('created_at')
		.notNull()
		.default(sql`(NOW())`),
	updatedAt: datetime('updated_at')
		.notNull()
		.default(sql`(NOW())`)
});

export const translator = mysqlTable('translator', {
	id: varchar('id', { length: 255 })
		.primaryKey()
		.default(sql`(UUID())`),
	name: varchar('name', { length: 255 }).notNull().unique(),
	userId: varchar('user_id', { length: 255 }).references(() => user.id),
	pages: text('pages').notNull(),
	discordId: varchar('discord_id', { length: 255 }).unique(),
	createdAt: datetime('created_at')
		.notNull()
		.default(sql`(NOW())`),
	updatedAt: datetime('updated_at')
		.notNull()
		.default(sql`(NOW())`)
});

export const config = mysqlTable('config', {
	id: varchar('id', { length: 255 }).primaryKey().default('main'),
	appName: varchar('app_name', { length: 255 }).notNull().default('F95 France'),
	googleSpreadsheetId: varchar('google_spreadsheet_id', { length: 255 }),
	googleOAuthAccessToken: text('google_oauth_access_token'),
	googleOAuthRefreshToken: text('google_oauth_refresh_token'),
	googleOAuthTokenExpiry: datetime('google_oauth_token_expiry'),
	autoCheckLastRunAt: datetime('auto_check_last_run_at'),
	maintenanceMode: boolean('maintenance_mode').notNull().default(false),
	updatedAt: datetime('updated_at')
		.notNull()
		.default(sql`(NOW())`)
});

export const submission = mysqlTable(
	'submission',
	{
		id: varchar('id', { length: 255 })
			.primaryKey()
			.default(sql`(UUID())`),
		userId: varchar('user_id', { length: 255 })
			.notNull()
			.references(() => user.id),
		openedByUserId: varchar('opened_by_user_id', { length: 255 }).references(() => user.id, {
			onDelete: 'set null'
		}),
		reviewedByUserId: varchar('reviewed_by_user_id', { length: 255 }).references(() => user.id, {
			onDelete: 'set null'
		}),
		status: varchar('status', { length: 32 }).notNull().default('pending'),
		gameId: varchar('game_id', { length: 255 }).references(() => game.id),
		translationId: varchar('translation_id', { length: 255 }).references(() => gameTranslation.id),
		type: varchar('type', { length: 32 }).notNull(),
		data: text('data').notNull(),
		adminNotes: text('admin_notes'),
		createdAt: datetime('created_at')
			.notNull()
			.default(sql`(NOW())`),
		updatedAt: datetime('updated_at')
			.notNull()
			.default(sql`(NOW())`)
	},
	(table) => [
		index('submission_status_idx').on(table.status),
		index('submission_user_id_status_idx').on(table.userId, table.status)
	]
);

export const autoCheckRun = mysqlTable(
	'auto_check_run',
	{
		id: varchar('id', { length: 255 })
			.primaryKey()
			.default(sql`(UUID())`),
		triggerSource: varchar('trigger_source', { length: 32 }).notNull(),
		status: varchar('status', { length: 32 }).notNull(),
		scannedGames: int('scanned_games').notNull().default(0),
		updatedGames: int('updated_games').notNull().default(0),
		updatedTranslations: int('updated_translations').notNull().default(0),
		alignedGames: int('aligned_games').notNull().default(0),
		translatorWebhooksSent: int('translator_webhooks_sent').notNull().default(0),
		proofreaderWebhooksSent: int('proofreader_webhooks_sent').notNull().default(0),
		issueCount: int('issue_count').notNull().default(0),
		durationMs: int('duration_ms'),
		fatalError: text('fatal_error'),
		startedAt: datetime('started_at')
			.notNull()
			.default(sql`(NOW())`),
		finishedAt: datetime('finished_at')
	},
	(table) => [index('auto_check_run_started_at_idx').on(table.startedAt)]
);

export const autoCheckRunItem = mysqlTable(
	'auto_check_run_item',
	{
		id: varchar('id', { length: 255 })
			.primaryKey()
			.default(sql`(UUID())`),
		runId: varchar('run_id', { length: 255 })
			.notNull()
			.references(() => autoCheckRun.id, { onDelete: 'cascade' }),
		kind: varchar('kind', { length: 32 }).notNull(),
		gameId: varchar('game_id', { length: 255 }).references(() => game.id, { onDelete: 'set null' }),
		gameName: varchar('game_name', { length: 512 }),
		translationId: varchar('translation_id', { length: 255 }).references(() => gameTranslation.id, {
			onDelete: 'set null'
		}),
		translationName: varchar('translation_name', { length: 255 }),
		threadId: int('thread_id'),
		oldVersion: varchar('old_version', { length: 128 }),
		newVersion: varchar('new_version', { length: 128 }),
		stage: varchar('stage', { length: 64 }),
		message: text('message'),
		detail: text('detail')
	},
	(table) => [index('auto_check_run_item_run_id_idx').on(table.runId)]
);

export const apiLog = mysqlTable('api_log', {
	id: varchar('id', { length: 255 })
		.primaryKey()
		.default(sql`(UUID())`),
	userId: varchar('user_id', { length: 255 }).references(() => user.id, {
		onDelete: 'set null',
		onUpdate: 'cascade'
	}),
	method: varchar('method', { length: 16 }).notNull(),
	route: text('route').notNull(),
	status: int('status').notNull(),
	ipAddress: varchar('ip_address', { length: 64 }),
	payload: text('payload'),
	errorMessage: text('error_message'),
	createdAt: datetime('created_at')
		.notNull()
		.default(sql`(NOW())`)
});

export const appLog = mysqlTable('app_log', {
	id: varchar('id', { length: 255 })
		.primaryKey()
		.default(sql`(UUID())`),
	level: varchar('level', { length: 16 }).notNull(),
	source: varchar('source', { length: 64 }).notNull(),
	message: text('message').notNull(),
	meta: text('meta'),
	createdAt: datetime('created_at')
		.notNull()
		.default(sql`(NOW())`)
});

export const notification = mysqlTable('notification', {
	id: varchar('id', { length: 255 })
		.primaryKey()
		.default(sql`(UUID())`),
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
	metadata: text('metadata'),
	createdAt: datetime('created_at')
		.notNull()
		.default(sql`(NOW())`)
});

export const appRole = mysqlTable('app_role', {
	slug: varchar('slug', { length: 64 }).primaryKey(),
	label: varchar('label', { length: 255 }).notNull(),
	description: text('description'),
	editMode: varchar('edit_mode', { length: 32 }).notNull().default('direct'),
	badgeStyle: varchar('badge_style', { length: 32 }).notNull().default('default'),
	staff: boolean('staff').notNull().default(false),
	priority: int('priority').notNull().default(0),
	maxApiKeys: int('max_api_keys').notNull().default(3),
	isSystem: boolean('is_system').notNull().default(false),
	createdAt: datetime('created_at')
		.notNull()
		.default(sql`(NOW())`),
	updatedAt: datetime('updated_at')
		.notNull()
		.default(sql`(NOW())`)
});

export const appPermission = mysqlTable('app_permission', {
	key: varchar('key', { length: 64 }).primaryKey(),
	label: varchar('label', { length: 255 }).notNull(),
	description: text('description'),
	group: varchar('group', { length: 64 })
});

export const appRolePermission = mysqlTable(
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

export const updateHistory = mysqlTable('update_history', {
	id: varchar('id', { length: 255 })
		.primaryKey()
		.default(sql`(UUID())`),
	updateId: varchar('update_id', { length: 255 })
		.notNull()
		.references(() => update.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	userId: varchar('user_id', { length: 255 }).references(() => user.id, {
		onDelete: 'set null',
		onUpdate: 'cascade'
	}),
	action: varchar('action', { length: 32 }).notNull(),
	changes: text('changes'),
	createdAt: datetime('created_at')
		.notNull()
		.default(sql`(NOW())`)
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
export type AutoCheckRun = typeof autoCheckRun.$inferSelect;
export type AutoCheckRunItem = typeof autoCheckRunItem.$inferSelect;
export type ApiLog = typeof apiLog.$inferSelect;
export type AppLog = typeof appLog.$inferSelect;
export type Notification = typeof notification.$inferSelect;
export type ApiKey = typeof apiKey.$inferSelect;
export type ApiKeyRate = typeof apiKeyRate.$inferSelect;
export type AppRole = typeof appRole.$inferSelect;
export type AppPermission = typeof appPermission.$inferSelect;
