import { toConfigClientSafe, type ConfigClientSafe } from '$lib/server/app-config';
import type { Config } from '$lib/server/db/schema';
import { isDiscordOAuthAutoRoleSyncEnabled } from '$lib/server/discord-oauth';
import { isSmtpConfigured } from '$lib/server/mail';
import { privateEnv } from '$lib/server/private-env';
import {
	getRequiredRegistrationInviteCode,
	isRegistrationEnabled,
	isRegistrationInviteRequired
} from '$lib/server/registration-policy';
import {
	buildSecurityTxtContent,
	getSecurityTxtPublicUrl,
	parseSecurityTxt,
	validateSecurityTxt
} from '$lib/server/security-txt';
import { isLibreTranslateConfigured } from '$lib/server/translate-libretranslate';
import { SITE } from '$lib/site';

export type DevServiceCheckStatus = 'ok' | 'partial' | 'missing';

export type DevServiceCheck = {
	status: DevServiceCheckStatus;
	label: string;
	hints: string[];
};

export type DevSecurityCheck = {
	id: string;
	label: string;
	configured: boolean;
	optional?: boolean;
	/** Libellé du badge (ex. Activé / Désactivé). */
	statusLabel?: string;
	hints?: string[];
};

export type DevServicesStatus = {
	registration: {
		enabled: boolean;
		inviteRequired: boolean;
		inviteCode: string | null;
	};
	googleSpreadsheetId: string | null;
	services: {
		google: DevServiceCheck;
		mail: DevServiceCheck;
		libreTranslate: DevServiceCheck;
		cron: DevServiceCheck;
	};
	/** Secrets / intégrations testables (latence après « Tout tester »). */
	security: DevSecurityCheck[];
	/** Variables d’environnement vérifiées localement, sans test réseau. */
	environment: DevSecurityCheck[];
};

function envDefined(name: string): boolean {
	return Boolean(privateEnv(name)?.trim());
}

function buildGoogleStatus(config: ConfigClientSafe | null): DevServiceCheck {
	const spreadsheetId = config?.googleSpreadsheetId?.trim() || null;
	const hasApiKey = config?.secretSources.googleApiKey === 'env';
	const hasOAuthClient = config?.canUseGoogleOAuth === true;
	const hasOAuthToken = config?.hasGoogleOAuthToken === true;

	const hints: string[] = [];

	if (!spreadsheetId) {
		hints.push('Définir GOOGLE_SPREADSHEET_ID ou l’ID dans les paramètres.');
	}
	if (!hasApiKey && !hasOAuthClient) {
		hints.push('Configurer GOOGLE_API_KEY ou GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET.');
	}
	if (hasOAuthClient && !hasOAuthToken && !hasApiKey) {
		hints.push('Autoriser Google OAuth depuis les paramètres ou fournir une clé API.');
	}
	if (hasApiKey && !spreadsheetId) {
		hints.push('Clé API présente — il manque l’ID du spreadsheet.');
	}

	const authReady = hasApiKey || (hasOAuthClient && hasOAuthToken);
	if (spreadsheetId && authReady) {
		return {
			status: 'ok',
			label: hasOAuthToken ? 'OAuth connecté' : 'Clé API',
			hints: []
		};
	}

	if (spreadsheetId || hasApiKey || hasOAuthClient || hasOAuthToken) {
		return { status: 'partial', label: 'Configuration incomplète', hints };
	}

	return {
		status: 'missing',
		label: 'Non configuré',
		hints: hints.length > 0 ? hints : ['Aucune variable Google détectée.']
	};
}

function buildMailStatus(): DevServiceCheck {
	const host = envDefined('SMTP_HOST');
	const user = envDefined('SMTP_USER');
	const pass = envDefined('SMTP_PASS');
	const from = envDefined('SMTP_FROM');
	const skipVerification = envDefined('EMAIL_VERIFICATION_SKIP');

	if (isSmtpConfigured()) {
		const hints: string[] = [];
		if (!from) hints.push('SMTP_FROM absent — l’adresse expéditeur par défaut sera utilisée.');
		if (skipVerification) hints.push('EMAIL_VERIFICATION_SKIP actif — pas d’email réel en dev.');
		return {
			status: 'ok',
			label: skipVerification ? 'SMTP (envoi simulé)' : 'SMTP prêt',
			hints
		};
	}

	const hints: string[] = [];
	if (!host) hints.push('SMTP_HOST manquant.');
	if (!user) hints.push('SMTP_USER manquant.');
	if (!pass) hints.push('SMTP_PASS manquant.');

	if (host || user || pass) {
		return { status: 'partial', label: 'SMTP incomplet', hints };
	}

	return {
		status: 'missing',
		label: 'Non configuré',
		hints: ['Définir SMTP_HOST, SMTP_USER et SMTP_PASS.']
	};
}

function buildLibreTranslateStatus(): DevServiceCheck {
	const url = envDefined('LIBRETRANSLATE_URL');
	const apiKey = envDefined('LIBRETRANSLATE_API_KEY');
	const autoOff =
		privateEnv('DESCRIPTION_AUTO_TRANSLATE')?.trim().toLowerCase() === 'false' ||
		privateEnv('TRANSLATION_PROVIDER')?.trim().toLowerCase() === 'off';

	if (!isLibreTranslateConfigured()) {
		return {
			status: 'missing',
			label: 'Non configuré',
			hints: ['Définir LIBRETRANSLATE_URL.']
		};
	}

	const hints: string[] = [];
	if (!apiKey) hints.push('LIBRETRANSLATE_API_KEY absent (optionnel selon l’instance).');
	if (autoOff)
		hints.push('Traduction auto des descriptions désactivée par variable d’environnement.');

	return {
		status: apiKey && !autoOff ? 'ok' : 'partial',
		label: autoOff ? 'URL OK (auto off)' : apiKey ? 'Prêt' : 'URL OK',
		hints
	};
}

function buildCronStatus(): DevServiceCheck {
	if (envDefined('CRON_SECRET')) {
		return {
			status: 'ok',
			label: 'CRON_SECRET défini',
			hints: ['Protège POST /api/cron/check-version (Bearer ou X-Cron-Secret).']
		};
	}
	return {
		status: 'missing',
		label: 'CRON_SECRET absent',
		hints: ['Définir CRON_SECRET pour sécuriser /api/cron/check-version.']
	};
}

function buildDiscordAutoRoleSyncCheck(): DevSecurityCheck {
	const enabled = isDiscordOAuthAutoRoleSyncEnabled();
	const raw = privateEnv('DISCORD_OAUTH_AUTO_ROLE_SYNC')?.trim();
	const guildId = envDefined('DISCORD_OAUTH_GUILD_ID');
	const roleId = envDefined('DISCORD_OAUTH_TRANSLATOR_ROLE_ID');
	const hints: string[] = [];

	if (!raw && enabled) {
		hints.push('Variable absente — activé par défaut.');
	}
	if (enabled && !guildId) {
		hints.push('DISCORD_OAUTH_GUILD_ID manquant pour la sync des rôles.');
	}
	if (enabled && !roleId) {
		hints.push('DISCORD_OAUTH_TRANSLATOR_ROLE_ID manquant.');
	}

	const syncReady = !enabled || (guildId && roleId);

	return {
		id: 'discord-oauth-auto-role-sync',
		label: 'DISCORD_OAUTH_AUTO_ROLE_SYNC',
		configured: syncReady && (enabled || Boolean(raw)),
		optional: !enabled,
		statusLabel: !enabled ? 'Désactivé' : syncReady ? 'Activé' : 'Activé (incomplet)',
		hints: hints.length > 0 ? hints : undefined
	};
}

function buildSecurityTxtCheck(): DevSecurityCheck {
	const errors = validateSecurityTxt(parseSecurityTxt(buildSecurityTxtContent()));
	const publicUrl = getSecurityTxtPublicUrl();
	const hints: string[] = [...errors];

	if (!envDefined('SECURITY_CONTACT')) {
		hints.push(`Contact par défaut : ${SITE.defaultSecurityContact}`);
	}
	if (!publicUrl) {
		hints.push('PUBLIC_APP_ORIGIN absent — l’URL publique ne sera pas vérifiée au test.');
	}
	if (!envDefined('SECURITY_OPENPGP_FINGERPRINT') && !envDefined('SECURITY_OPENPGP_KEY_URL')) {
		hints.push(
			'Encryption optionnelle (SECURITY_OPENPGP_FINGERPRINT ou SECURITY_OPENPGP_KEY_URL).'
		);
	}

	const configured = errors.length === 0;
	return {
		id: 'security-txt',
		label: 'Sécurité (RFC 9116) — security.txt',
		configured,
		statusLabel: configured ? (publicUrl ? 'Configuré' : 'Local OK') : 'Incomplet',
		hints: hints.length > 0 ? hints : undefined
	};
}

function buildSecurityChecks(config: ConfigClientSafe | null): {
	security: DevSecurityCheck[];
	environment: DevSecurityCheck[];
} {
	const turnstileSite = envDefined('PUBLIC_TURNSTILE_SITE_KEY');
	const turnstileSecret = envDefined('TURNSTILE_SECRET_KEY');

	const environment: DevSecurityCheck[] = [
		{
			id: 'token-encryption',
			label: 'CONFIG_TOKEN_ENCRYPTION_KEY',
			configured: config?.tokenEncryptionActive === true
		},
		buildDiscordAutoRoleSyncCheck(),
		{
			id: 'app-origin',
			label: 'PUBLIC_APP_ORIGIN',
			configured: envDefined('PUBLIC_APP_ORIGIN')
		}
	];

	const security: DevSecurityCheck[] = [
		buildSecurityTxtCheck(),
		{
			id: 'discord-oauth',
			label: 'DISCORD_OAUTH_CLIENT_ID + SECRET',
			configured: envDefined('DISCORD_OAUTH_CLIENT_ID') && envDefined('DISCORD_OAUTH_CLIENT_SECRET')
		},
		{
			id: 'discord-webhook-updates',
			label: 'DISCORD_WEBHOOK_UPDATES',
			configured: config?.secretSources.discordUpdates === 'env',
			optional: true
		},
		{
			id: 'discord-webhook-translators',
			label: 'DISCORD_WEBHOOK_TRANSLATORS',
			configured: config?.secretSources.discordTranslators === 'env',
			optional: true
		},
		{
			id: 'discord-webhook-admin',
			label: 'DISCORD_WEBHOOK_ADMIN',
			configured: config?.secretSources.discordAdmin === 'env',
			optional: true
		},
		{
			id: 'turnstile',
			label: 'Turnstile (PUBLIC_TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY)',
			configured: turnstileSite && turnstileSecret,
			optional: true
		}
	];

	return { security, environment };
}

export function getDevServicesStatus(configRow: Config | null): DevServicesStatus {
	const clientSafe = configRow ? toConfigClientSafe(configRow) : null;
	const { security, environment } = buildSecurityChecks(clientSafe);

	return {
		registration: {
			enabled: isRegistrationEnabled(),
			inviteRequired: isRegistrationInviteRequired(),
			inviteCode: getRequiredRegistrationInviteCode()
		},
		googleSpreadsheetId: clientSafe?.googleSpreadsheetId ?? null,
		services: {
			google: buildGoogleStatus(clientSafe),
			mail: buildMailStatus(),
			libreTranslate: buildLibreTranslateStatus(),
			cron: buildCronStatus()
		},
		security,
		environment
	};
}
