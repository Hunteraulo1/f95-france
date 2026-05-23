#!/usr/bin/env node
/**
 * Déclenche POST /api/cron/check-version (Coolify Scheduled Tasks, CI, etc.).
 *
 * Variables :
 * - CRON_SECRET (requis)
 * - CRON_BASE_URL (optionnel, défaut http://127.0.0.1:3000)
 *   Utiliser https://f95france.site si la tâche s’exécute hors du conteneur app.
 */

const secret = process.env.CRON_SECRET?.trim();
const baseUrl = (process.env.CRON_BASE_URL?.trim() || 'http://127.0.0.1:3000').replace(/\/$/, '');
const url = `${baseUrl}/api/cron/check-version`;
const timeoutMs = Number.parseInt(process.env.CRON_HTTP_TIMEOUT_MS ?? '30000', 10);

if (!secret) {
	console.error('[cron-check-version] CRON_SECRET manquant');
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
		console.info('[cron-check-version] OK', response.status, parsed);
		process.exit(0);
	}

	console.error('[cron-check-version] échec HTTP', response.status, parsed);
	process.exit(1);
} catch (error) {
	console.error('[cron-check-version] erreur réseau:', error);
	process.exit(1);
}
