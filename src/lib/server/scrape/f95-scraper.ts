import { privateEnv } from '#lib/server/private-env';
import * as v from 'valibot';

/**
 * Client du service f95list-scraper (branche `v4`), qui relaie l’API de F95Checker (WillyJL).
 * F95Zone bloque les accès directs (Cloudflare) : `checker.php` et le HTML des threads ne passent plus.
 * Le service n’écrit rien : c’est ici que l’on conserve `f95LastChange` pour éviter les `/full` inutiles.
 */

/** Maximum accepté par le scraper est 50 ; 20 garde le pire cas (2 `/fast` de 120 s) sous le timeout. */
export const F95_SCRAPER_CHECK_BATCH = 20;
const CHECK_TIMEOUT_MS = 280_000;
const THREAD_TIMEOUT_MS = 120_000;

const threadSchema = v.object({
	name: v.string(),
	version: v.nullable(v.string()),
	developer: v.nullable(v.string()),
	type: v.number(),
	status: v.number(),
	tags: v.array(v.number()),
	imageUrl: v.nullable(v.string()),
	description: v.string(),
	lastUpdated: v.number()
});

const threadStatusSchema = v.nullable(
	v.picklist(['in_progress', 'completed', 'on_hold', 'abandoned'])
);

const checkResultSchema = v.variant('result', [
	v.object({
		id: v.number(),
		result: v.literal('changed'),
		lastChange: v.number(),
		status: threadStatusSchema,
		thread: threadSchema
	}),
	v.object({ id: v.number(), result: v.literal('unchanged'), lastChange: v.number() }),
	v.object({ id: v.number(), result: v.literal('not_found') }),
	v.object({
		id: v.number(),
		result: v.literal('failed'),
		kind: v.string(),
		message: v.string()
	})
]);

const checkResponseSchema = v.object({ results: v.array(checkResultSchema) });

const threadResponseSchema = v.object({
	threadId: v.number(),
	lastChange: v.number(),
	status: threadStatusSchema,
	thread: threadSchema
});

export type F95ScraperThread = v.InferOutput<typeof threadSchema>;
export type F95ScraperThreadStatus = v.InferOutput<typeof threadStatusSchema>;
export type F95ScraperCheckResult = v.InferOutput<typeof checkResultSchema>;
export type F95ScraperThreadResponse = v.InferOutput<typeof threadResponseSchema>;

export class F95ScraperError extends Error {
	constructor(
		message: string,
		readonly status?: number
	) {
		super(message);
		this.name = 'F95ScraperError';
	}
}

function scraperConfig(): { baseUrl: string; token: string } {
	const baseUrl = privateEnv('F95_SCRAPER_URL');
	const token = privateEnv('F95_SCRAPER_TOKEN');
	if (!baseUrl || !token) {
		throw new F95ScraperError('F95_SCRAPER_URL et F95_SCRAPER_TOKEN doivent être définis');
	}
	return { baseUrl: baseUrl.replace(/\/+$/, ''), token };
}

async function scraperRequest<TSchema extends v.GenericSchema>(
	path: string,
	schema: TSchema,
	init: { method?: string; body?: unknown; timeoutMs: number }
): Promise<v.InferOutput<TSchema>> {
	const { baseUrl, token } = scraperConfig();
	const response = await fetch(`${baseUrl}${path}`, {
		method: init.method ?? 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/json',
			...(init.body === undefined ? {} : { 'Content-Type': 'application/json' })
		},
		body: init.body === undefined ? undefined : JSON.stringify(init.body),
		signal: AbortSignal.timeout(init.timeoutMs)
	});

	if (!response.ok) {
		const detail = await response.text().catch(() => '');
		throw new F95ScraperError(
			`Scraper ${init.method ?? 'GET'} ${path} : HTTP ${response.status} ${detail.slice(0, 200)}`.trim(),
			response.status
		);
	}

	const parsed = v.safeParse(schema, await response.json());
	if (!parsed.success) {
		throw new F95ScraperError(`Scraper ${path} : réponse invalide (${v.summarize(parsed.issues)})`);
	}
	return parsed.output;
}

/** Données fraîches d’un thread (`/fast` puis `/full` côté scraper). 404 si le thread n’existe plus. */
export function fetchF95ScraperThread(threadId: number): Promise<F95ScraperThreadResponse> {
	return scraperRequest(`/threads/${threadId}`, threadResponseSchema, {
		timeoutMs: THREAD_TIMEOUT_MS
	});
}

/**
 * Vérifie un lot de threads (au plus {@link F95_SCRAPER_CHECK_BATCH}) : `lastChange` nul force `/full`.
 * Un thread en échec n’invalide pas le lot ; seule une panne du scraper lève une erreur.
 */
export function checkF95ScraperThreads(
	threads: { id: number; lastChange: number | null }[]
): Promise<F95ScraperCheckResult[]> {
	return scraperRequest('/threads/check', checkResponseSchema, {
		method: 'POST',
		body: { threads },
		timeoutMs: CHECK_TIMEOUT_MS
	}).then((r) => r.results);
}
