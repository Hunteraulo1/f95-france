#!/usr/bin/env node
/**
 * Déclenche POST /api/cron/check-version (Coolify Scheduled Tasks, CI, etc.).
 *
 * Variables :
 * - SERVICE_PASSWORD_64_CRON-SECRET (requis)
 * - CRON_BASE_URL (optionnel, prioritaire)
 * - sinon SERVICE_URL_APP
 * - sinon http://127.0.0.1:3000 (dev local uniquement)
 */

const secret = process.env['SERVICE_PASSWORD_64_CRON-SECRET']?.trim();

function resolveCronBaseUrl() {
	const explicit = process.env.CRON_BASE_URL?.trim();
	if (explicit) return explicit.replace(/\/$/, '');

	const value = process.env['SERVICE_URL_APP']?.trim();
	if (value) return value.replace(/\/$/, '');

	return 'http://127.0.0.1:3000';
}

const baseUrl = resolveCronBaseUrl();
const url = `${baseUrl}/api/cron/check-version`;
const timeoutMs = Number.parseInt(process.env.CRON_HTTP_TIMEOUT_MS ?? '30000', 10);

if (!secret) {
	console.error('[cron-check-version] SERVICE_PASSWORD_64_CRON-SECRET manquant');
	process.exit(1);
}

try {
	const response = await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${secret}`,
			'Content-Type': 'application/json'
		},
		signal: AbortSignal.timeout(Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30_000)
	});

	const body = await response.text();
	let parsed = body;
	try {
		parsed = JSON.parse(body);
	} catch {
		// corps non JSON
	}

	if (response.ok) {
		console.info('[cron-check-version] OK', response.status, url, parsed);
		process.exit(0);
	}

	console.error('[cron-check-version] échec HTTP', response.status, url, parsed);
	process.exit(1);
} catch (error) {
	console.error('[cron-check-version] erreur réseau vers', url, error);
	process.exit(1);
}
