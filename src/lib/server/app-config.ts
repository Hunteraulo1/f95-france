import { openOAuthToken, sealOAuthToken } from '$lib/server/config-token-crypto';
import { db } from '$lib/server/db';
import type { Config } from '$lib/server/db/schema';
import * as table from '$lib/server/db/schema';
import { privateEnv } from '$lib/server/private-env';
import { eq } from 'drizzle-orm';

function envFirst(name: string, dbVal: string | null | undefined): string | null {
	const v = privateEnv(name);
	if (v) return v;
	return dbVal ?? null;
}

function secretSource(
	envName: string,
	dbVal: string | null | undefined
): 'env' | 'database' | 'none' {
	if (privateEnv(envName)) return 'env';
	if (dbVal?.trim()) return 'database';
	return 'none';
}

/** Fusionne les secrets issus des variables d'environnement (prioritaires) avec la ligne SQL. */
export function mergeEnvIntoConfigRow(row: Config): Config {
	return {
		...row,
		discordWebhookUpdates: envFirst('DISCORD_WEBHOOK_UPDATES', row.discordWebhookUpdates),
		discordWebhookLogs: envFirst('DISCORD_WEBHOOK_LOGS', row.discordWebhookLogs),
		discordWebhookTranslators: envFirst(
			'DISCORD_WEBHOOK_TRANSLATORS',
			row.discordWebhookTranslators
		),
		discordWebhookProofreaders: envFirst(
			'DISCORD_WEBHOOK_PROOFREADERS',
			row.discordWebhookProofreaders
		),
		googleSpreadsheetId: envFirst('GOOGLE_SPREADSHEET_ID', row.googleSpreadsheetId),
		googleApiKey: envFirst('GOOGLE_API_KEY', row.googleApiKey),
		googleOAuthClientId: envFirst('GOOGLE_OAUTH_CLIENT_ID', row.googleOAuthClientId),
		googleOAuthClientSecret: envFirst('GOOGLE_OAUTH_CLIENT_SECRET', row.googleOAuthClientSecret),
		googleOAuthAccessToken: openOAuthToken(row.googleOAuthAccessToken),
		googleOAuthRefreshToken: openOAuthToken(row.googleOAuthRefreshToken)
	};
}

export async function getEffectiveConfig(): Promise<Config | undefined> {
	const [row] = await db.select().from(table.config).where(eq(table.config.id, 'main')).limit(1);
	if (!row) return undefined;
	return mergeEnvIntoConfigRow(row);
}

/** Même logique que getEffectiveConfig à partir d’une ligne déjà chargée. */
export function getEffectiveConfigFromRow(row: Config): Config {
	return mergeEnvIntoConfigRow(row);
}

export type ConfigClientSafe = Pick<
	Config,
	| 'id'
	| 'appName'
	| 'maintenanceMode'
	| 'autoCheckIntervalMinutes'
	| 'autoCheckReferenceTime'
	| 'autoCheckLastRunAt'
	| 'updatedAt'
> & {
	googleSpreadsheetId: string | null;
	secretSources: {
		discordUpdates: 'env' | 'database' | 'none';
		discordTranslators: 'env' | 'database' | 'none';
		discordProofreaders: 'env' | 'database' | 'none';
		googleApiKey: 'env' | 'database' | 'none';
		googleOAuthClient: 'env' | 'database' | 'none';
	};
	hasGoogleOAuthToken: boolean;
	canUseGoogleOAuth: boolean;
	tokenEncryptionActive: boolean;
};

export function toConfigClientSafe(row: Config): ConfigClientSafe {
	const idEnv = secretSource('GOOGLE_OAUTH_CLIENT_ID', row.googleOAuthClientId);
	const secretEnv = secretSource('GOOGLE_OAUTH_CLIENT_SECRET', row.googleOAuthClientSecret);
	const googleOAuthClient: 'env' | 'database' | 'none' =
		idEnv === 'env' || secretEnv === 'env'
			? 'env'
			: idEnv === 'database' && secretEnv === 'database'
				? 'database'
				: 'none';

	return {
		id: row.id,
		appName: row.appName,
		maintenanceMode: row.maintenanceMode,
		autoCheckIntervalMinutes: row.autoCheckIntervalMinutes,
		autoCheckReferenceTime: row.autoCheckReferenceTime,
		autoCheckLastRunAt: row.autoCheckLastRunAt,
		updatedAt: row.updatedAt,
		googleSpreadsheetId: envFirst('GOOGLE_SPREADSHEET_ID', row.googleSpreadsheetId),
		secretSources: {
			discordUpdates: secretSource('DISCORD_WEBHOOK_UPDATES', row.discordWebhookUpdates),
			discordTranslators: secretSource(
				'DISCORD_WEBHOOK_TRANSLATORS',
				row.discordWebhookTranslators
			),
			discordProofreaders: secretSource(
				'DISCORD_WEBHOOK_PROOFREADERS',
				row.discordWebhookProofreaders
			),
			googleApiKey: secretSource('GOOGLE_API_KEY', row.googleApiKey),
			googleOAuthClient
		},
		hasGoogleOAuthToken: Boolean(row.googleOAuthAccessToken?.trim()),
		canUseGoogleOAuth:
			Boolean(envFirst('GOOGLE_OAUTH_CLIENT_ID', row.googleOAuthClientId)?.trim()) &&
			Boolean(envFirst('GOOGLE_OAUTH_CLIENT_SECRET', row.googleOAuthClientSecret)?.trim()),
		tokenEncryptionActive: Boolean(privateEnv('CONFIG_TOKEN_ENCRYPTION_KEY'))
	};
}

/** Champs à persister pour les jetons OAuth (chiffrés si clé définie). */
export function oauthTokenFieldsForDb(
	plainAccess: string,
	plainRefresh: string | null | undefined
) {
	return {
		googleOAuthAccessToken: sealOAuthToken(plainAccess),
		googleOAuthRefreshToken: sealOAuthToken(plainRefresh ?? null)
	};
}
