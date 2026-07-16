import { openOAuthToken, sealOAuthToken } from '$lib/server/config-token-crypto';
import { db } from '$lib/server/db';
import type { Config } from '$lib/server/db/schema';
import * as table from '$lib/server/db/schema';
import { privateEnv } from '$lib/server/private-env';
import { eq } from 'drizzle-orm';

function envTrim(name: string): string | null {
	const v = privateEnv(name);
	const t = v?.trim();
	return t ? t : null;
}

function envFirstSpreadsheetId(row: Config): string | null {
	return envTrim('GOOGLE_SPREADSHEET_ID') ?? (row.googleSpreadsheetId?.trim() || null);
}

/**
 * Ligne `config` enrichie : webhooks / clé API / client OAuth viennent uniquement des variables
 * d’environnement ; `google_spreadsheet_id` peut encore venir de la base si `GOOGLE_SPREADSHEET_ID`
 * est absent ; les jetons OAuth en base sont déchiffrés pour usage applicatif.
 */
export type EffectiveAppConfig = Config & {
	discordWebhookUpdates: string | null;
	discordWebhookTranslators: string | null;
	discordWebhookAdmin: string | null;
	discordBotToken: string | null;
	googleApiKey: string | null;
	googleOAuthClientId: string | null;
	googleOAuthClientSecret: string | null;
	googleOAuthAccessToken: string | null;
	googleOAuthRefreshToken: string | null;
	googleSpreadsheetId: string | null;
};

export function mergeEnvIntoConfigRow(row: Config): EffectiveAppConfig {
	return {
		...row,
		googleSpreadsheetId: envFirstSpreadsheetId(row),
		discordWebhookUpdates: envTrim('DISCORD_WEBHOOK_UPDATES'),
		discordWebhookTranslators: envTrim('DISCORD_WEBHOOK_TRANSLATORS'),
		discordWebhookAdmin: envTrim('DISCORD_WEBHOOK_ADMIN'),
		discordBotToken: envTrim('DISCORD_BOT_TOKEN'),
		googleApiKey: envTrim('GOOGLE_API_KEY'),
		googleOAuthClientId: envTrim('GOOGLE_OAUTH_CLIENT_ID'),
		googleOAuthClientSecret: envTrim('GOOGLE_OAUTH_CLIENT_SECRET'),
		googleOAuthAccessToken: openOAuthToken(row.googleOAuthAccessToken),
		googleOAuthRefreshToken: openOAuthToken(row.googleOAuthRefreshToken)
	};
}

export async function getEffectiveConfig(): Promise<EffectiveAppConfig | undefined> {
	const [row] = await db.select().from(table.config).where(eq(table.config.id, 'main')).limit(1);
	if (!row) return undefined;
	return mergeEnvIntoConfigRow(row);
}

/** Même logique que {@link getEffectiveConfig} à partir d’une ligne déjà chargée. */
export function getEffectiveConfigFromRow(row: Config): EffectiveAppConfig {
	return mergeEnvIntoConfigRow(row);
}

function envPresence(name: string): 'env' | 'none' {
	return envTrim(name) ? 'env' : 'none';
}

export type ConfigClientSafe = Pick<
	Config,
	'id' | 'appName' | 'maintenanceMode' | 'autoCheckLastRunAt' | 'updatedAt'
> & {
	googleSpreadsheetId: string | null;
	/** Indique si chaque secret est présent dans l’environnement serveur (plus de lecture en base). */
	secretSources: {
		discordUpdates: 'env' | 'none';
		discordTranslators: 'env' | 'none';
		discordAdmin: 'env' | 'none';
		discordBot: 'env' | 'none';
		googleApiKey: 'env' | 'none';
		googleOAuthClient: 'env' | 'none';
	};
	hasGoogleOAuthToken: boolean;
	canUseGoogleOAuth: boolean;
	tokenEncryptionActive: boolean;
};

export function toConfigClientSafe(row: Config): ConfigClientSafe {
	const idOk = Boolean(envTrim('GOOGLE_OAUTH_CLIENT_ID'));
	const secretOk = Boolean(envTrim('GOOGLE_OAUTH_CLIENT_SECRET'));

	return {
		id: row.id,
		appName: row.appName,
		maintenanceMode: row.maintenanceMode,
		autoCheckLastRunAt: row.autoCheckLastRunAt,
		updatedAt: row.updatedAt,
		googleSpreadsheetId: envFirstSpreadsheetId(row),
		secretSources: {
			discordUpdates: envPresence('DISCORD_WEBHOOK_UPDATES'),
			discordTranslators: envPresence('DISCORD_WEBHOOK_TRANSLATORS'),
			discordAdmin: envPresence('DISCORD_WEBHOOK_ADMIN'),
			discordBot: envPresence('DISCORD_BOT_TOKEN'),
			googleApiKey: envPresence('GOOGLE_API_KEY'),
			googleOAuthClient: idOk && secretOk ? 'env' : 'none'
		},
		hasGoogleOAuthToken: Boolean(row.googleOAuthAccessToken?.trim()),
		canUseGoogleOAuth: idOk && secretOk,
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
