import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import type { PermissionKey } from '$lib/permissions/catalog';
import { appLogWarn } from '$lib/server/app-log-bridge';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { randomUUID } from 'node:crypto';
import type { ManagerExtractDraft } from '$lib/server/extract-draft';
import { resolveGameAutoCheckForWebsite } from '$lib/server/game-auto-check';
import { resolveGameDescriptionFields } from '$lib/server/game-description-fr';
import { coerceGameEngineType } from '$lib/server/game-engine-type';
import { hasPermission } from '$lib/server/permissions';
import { resolveShouldCreateSubmissionForUser } from '$lib/server/role-edit-mode';
import { scrapeThread, type ScrapedThreadGame } from '$lib/server/scrape';
import type { GameEngineType } from '$lib/types';
import { normalizeCheckerVersion } from '$lib/utils/f95-checker-alignment';
import { and, eq, sql } from 'drizzle-orm';

const EXTRACT_PERMISSION: PermissionKey = 'games.manage';

/** Sites supportés par `/api/extract/{f95|lc}/[threadId]`. */
export type ExtractThreadWebsite = 'f95z' | 'lc';

export type ExtractDataSource = 'scrape' | 'payload';

const SITE_META: Record<
	ExtractThreadWebsite,
	{
		defaultLink: (threadId: number) => string;
		imageSeed: string;
	}
> = {
	f95z: {
		defaultLink: (tid) => `https://f95zone.to/threads/${tid}`,
		imageSeed: 'f95-extract'
	},
	lc: {
		defaultLink: (tid) => `https://lewdcorner.com/threads/${tid}`,
		imageSeed: 'lc-extract'
	}
};

export type ExtractGamePayload = {
	name: string;
	link: string;
	tags: string;
	image: string;
	description: string | null;
	gameVersion: string | null;
	gameAutoCheck: boolean;
	gameType: GameEngineType;
};

function parseAllowedOrigins(raw: string): Set<string> {
	return new Set(
		raw
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean)
	);
}

function allowedOriginsForSite(website: ExtractThreadWebsite): Set<string> {
	const raw =
		website === 'f95z'
			? (env.EXTRACT_F95_ALLOWED_ORIGINS ?? '')
			: (env.EXTRACT_LC_ALLOWED_ORIGINS ?? '');
	return parseAllowedOrigins(raw);
}

export function corsHeadersExtract(
	request: Request,
	website: ExtractThreadWebsite
): Record<string, string> {
	const origin = request.headers.get('origin');
	const headers: Record<string, string> = {
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key'
	};

	if (dev && origin) {
		headers['Access-Control-Allow-Origin'] = origin;
		headers['Access-Control-Allow-Credentials'] = 'true';
		headers.Vary = 'Origin';
		return headers;
	}

	const allowed = allowedOriginsForSite(website);
	if (origin && allowed.has(origin)) {
		headers['Access-Control-Allow-Origin'] = origin;
		headers['Access-Control-Allow-Credentials'] = 'true';
		headers.Vary = 'Origin';
	}
	return headers;
}

function clampStr(s: string, max: number): string {
	if (s.length <= max) return s;
	return s.slice(0, max);
}

export function canUseExtract(locals: App.Locals): boolean {
	return hasPermission(locals, EXTRACT_PERMISSION);
}

/** Version forum utilisable pour faire confiance au scrape (exclut `Unknown` et vide). */
export function isUsableScrapeVersion(version: string | null | undefined): boolean {
	return normalizeCheckerVersion(version) !== null;
}

/** Champs fournis explicitement par le client (query ou JSON), sans valeurs par défaut. */
function explicitClientPayload(method: string, request: Request, body: Record<string, unknown>) {
	if (method === 'GET') {
		const sp = new URL(request.url).searchParams;
		const out: Record<string, unknown> = {};
		const pick = (key: string, maxLen: number) => {
			const v = sp.get(key);
			if (v == null || !v.trim()) return;
			out[key] = clampStr(v.trim(), maxLen);
		};
		pick('name', 255);
		pick('tags', 20_000);
		pick('image', 500);
		pick('link', 500);
		pick('gameVersion', 100);
		pick('gameType', 50);
		const desc = sp.get('description');
		if (desc != null && desc.trim()) {
			out.description = desc.trim().slice(0, 100_000);
		}
		const gac = sp.get('gameAutoCheck');
		if (gac != null) {
			const lower = gac.toLowerCase();
			if (lower === '1' || lower === 'true' || lower === 'yes' || lower === 'oui') {
				out.gameAutoCheck = true;
			} else if (lower === '0' || lower === 'false' || lower === 'no' || lower === 'non') {
				out.gameAutoCheck = false;
			}
		}
		return out;
	}
	return body;
}

function inferExtractGameAutoCheck(
	website: ExtractThreadWebsite,
	dataSource: ExtractDataSource,
	gameVersion: string | null,
	explicit: Record<string, unknown>
): boolean {
	const explicitVal =
		typeof explicit.gameAutoCheck === 'boolean' ? explicit.gameAutoCheck : undefined;
	const inferredDefault = dataSource === 'scrape' && isUsableScrapeVersion(gameVersion);
	return resolveGameAutoCheckForWebsite(website, explicitVal, inferredDefault);
}

function payloadFromScrape(
	scraped: ScrapedThreadGame,
	explicit: Record<string, unknown>,
	threadId: number,
	website: ExtractThreadWebsite
): { ok: true; payload: ExtractGamePayload } | { ok: false; error: string } {
	const meta = SITE_META[website];
	const name = scraped.name?.trim();
	if (!name) {
		return { ok: false, error: 'Titre du thread introuvable sur le forum' };
	}

	const gameVersion = scraped.version?.trim() ? clampStr(scraped.version.trim(), 100) : null;

	return {
		ok: true,
		payload: {
			name: clampStr(name, 255),
			tags: clampStr((scraped.tags ?? '').trim(), 20_000),
			description: scraped.description?.trim()
				? scraped.description.trim().slice(0, 100_000)
				: null,
			gameVersion,
			gameType: scraped.gameType
				? coerceGameEngineType(scraped.gameType)
				: coerceGameEngineType(
						typeof explicit.gameType === 'string' ? explicit.gameType : undefined
					),
			image: scraped.image?.trim()
				? clampStr(scraped.image.trim(), 500)
				: `https://picsum.photos/seed/${meta.imageSeed}/400/225`,
			link:
				typeof explicit.link === 'string' && explicit.link.trim()
					? clampStr(explicit.link.trim(), 500)
					: meta.defaultLink(threadId),
			gameAutoCheck: inferExtractGameAutoCheck(website, 'scrape', gameVersion, explicit)
		}
	};
}

function payloadFromClient(
	explicit: Record<string, unknown>,
	threadId: number,
	website: ExtractThreadWebsite
):
	| { ok: true; payload: ExtractGamePayload }
	| { ok: false; status: number; body: Record<string, unknown> } {
	const meta = SITE_META[website];
	const name =
		typeof explicit.name === 'string' && explicit.name.trim()
			? clampStr(explicit.name.trim(), 255)
			: '';
	if (!name) {
		return {
			ok: false,
			status: 422,
			body: {
				error:
					'Nom du jeu requis : le scrape forum est indisponible ou la version est inconnue — envoyez les données du thread (name, tags, etc.).'
			}
		};
	}

	const gameVersion =
		typeof explicit.gameVersion === 'string' && explicit.gameVersion.trim()
			? clampStr(explicit.gameVersion.trim(), 100)
			: null;

	const image =
		typeof explicit.image === 'string' && explicit.image.trim()
			? clampStr(explicit.image.trim(), 500)
			: `https://picsum.photos/seed/${meta.imageSeed}/400/225`;

	return {
		ok: true,
		payload: {
			name,
			tags: typeof explicit.tags === 'string' ? clampStr(explicit.tags.trim(), 20_000) : '',
			description:
				typeof explicit.description === 'string' && explicit.description.trim()
					? explicit.description.trim().slice(0, 100_000)
					: null,
			gameVersion,
			gameType: coerceGameEngineType(
				typeof explicit.gameType === 'string' ? explicit.gameType : undefined
			),
			image,
			link:
				typeof explicit.link === 'string' && explicit.link.trim()
					? clampStr(explicit.link.trim(), 500)
					: meta.defaultLink(threadId),
			gameAutoCheck: inferExtractGameAutoCheck(website, 'payload', gameVersion, explicit)
		}
	};
}

function canUseScrapedData(scraped: ScrapedThreadGame | null): scraped is ScrapedThreadGame {
	if (!scraped) return false;
	if (!scraped.name?.trim()) return false;
	return isUsableScrapeVersion(scraped.version);
}

/** Scrape forum si possible ; sinon données client (payload Tampermonkey). */
async function resolveExtractPayload(
	method: string,
	request: Request,
	body: Record<string, unknown>,
	threadId: number,
	website: ExtractThreadWebsite
): Promise<
	| { ok: true; payload: ExtractGamePayload; dataSource: ExtractDataSource }
	| { ok: false; status: number; body: Record<string, unknown> }
> {
	const explicit = explicitClientPayload(method, request, body);

	let scraped: ScrapedThreadGame | null = null;
	try {
		scraped = await scrapeThread(website, threadId);
	} catch (error) {
		appLogWarn('scrape', `extract ${website}/${threadId} indisponible, repli payload`, error);
	}

	const dataSource: ExtractDataSource = canUseScrapedData(scraped) ? 'scrape' : 'payload';

	if (dataSource === 'scrape' && scraped) {
		const built = payloadFromScrape(scraped, explicit, threadId, website);
		if (!built.ok) {
			return { ok: false, status: 422, body: { error: built.error } };
		}
		return { ok: true, payload: built.payload, dataSource };
	}

	const built = payloadFromClient(explicit, threadId, website);
	if (!built.ok) {
		return { ok: false, status: built.status, body: built.body };
	}
	return { ok: true, payload: built.payload, dataSource };
}

function toManagerExtractDraft(
	payload: ExtractGamePayload,
	threadId: number,
	website: ExtractThreadWebsite
): ManagerExtractDraft {
	return {
		website,
		threadId,
		name: payload.name,
		tags: payload.tags,
		gameType: payload.gameType,
		image: payload.image,
		link: payload.link,
		description: payload.description,
		gameVersion: payload.gameVersion,
		gameAutoCheck: payload.gameAutoCheck
	};
}

export type ExtractThreadResult =
	| {
			ok: true;
			created: boolean;
			gameId?: string;
			redirectPath: string;
			redirectToAdd?: boolean;
			extractDraft?: ManagerExtractDraft;
	  }
	| { ok: false; status: number; body: Record<string, unknown> };

async function parseRequestBody(
	method: string,
	request: Request
): Promise<
	| { ok: true; body: Record<string, unknown> }
	| { ok: false; status: number; body: Record<string, unknown> }
> {
	if (method === 'POST') {
		const text = await request.text();
		if (!text.trim()) {
			return { ok: true, body: {} };
		}
		try {
			return { ok: true, body: JSON.parse(text) as Record<string, unknown> };
		} catch {
			return { ok: false, status: 400, body: { error: 'Corps JSON invalide' } };
		}
	}
	if (method === 'GET') {
		return { ok: true, body: {} };
	}
	return { ok: true, body: {} };
}

export async function runExtractThreadGame(input: {
	locals: App.Locals;
	threadIdParam: string | undefined;
	method: string;
	request: Request;
	website: ExtractThreadWebsite;
}): Promise<ExtractThreadResult> {
	const { locals, threadIdParam, method, request, website } = input;

	if (!locals.user) {
		return {
			ok: false,
			status: 401,
			body: {
				error:
					'Non authentifié. Depuis un autre site, un fetch n’envoie pas le cookie (SameSite=Lax). Utilisez une navigation du navigateur : window.open(url) ou location.href vers cette même URL GET (connecté au dashboard dans ce navigateur).'
			}
		};
	}
	if (!canUseExtract(locals)) {
		return {
			ok: false,
			status: 403,
			body: { error: 'Accès réservé aux comptes avec la permission « Gestion des jeux »' }
		};
	}

	const threadIdParsed = Number.parseInt(String(threadIdParam ?? ''), 10);
	if (!Number.isFinite(threadIdParsed) || threadIdParsed <= 0) {
		return { ok: false, status: 400, body: { error: 'ID de thread invalide' } };
	}

	const parsedBody = await parseRequestBody(method, request);
	if (!parsedBody.ok) {
		return { ok: false, status: parsedBody.status, body: parsedBody.body };
	}

	const existing = await db
		.select({ id: table.game.id })
		.from(table.game)
		.where(and(eq(table.game.website, website), eq(table.game.threadId, threadIdParsed)))
		.limit(1);

	if (existing[0]) {
		return {
			ok: true,
			created: false,
			gameId: existing[0].id,
			redirectPath: `/dashboard/game/${existing[0].id}`
		};
	}

	const pendingForThread = await db
		.select({ id: table.submission.id })
		.from(table.submission)
		.where(
			and(
				eq(table.submission.type, 'game'),
				eq(table.submission.status, 'pending'),
				sql`JSON_VALUE(data, '$.game.threadId') IS NOT NULL AND CAST(JSON_VALUE(data, '$.game.threadId') AS UNSIGNED) = ${threadIdParsed}`,
				sql`JSON_VALUE(data, '$.game.website') = ${website}`
			)
		)
		.limit(1);

	if (pendingForThread.length > 0) {
		return {
			ok: false,
			status: 409,
			body: { error: 'Une soumission pour ce thread est déjà en attente de validation.' }
		};
	}

	const resolved = await resolveExtractPayload(
		method,
		request,
		parsedBody.body,
		threadIdParsed,
		website
	);
	if (!resolved.ok) {
		return { ok: false, status: resolved.status, body: resolved.body };
	}

	const { payload, dataSource } = resolved;

	const shouldCreateSubmission = await resolveShouldCreateSubmissionForUser({
		roleSlug: locals.user.role,
		userDirectMode: locals.user.directMode ?? true
	});

	if (shouldCreateSubmission && dataSource === 'payload') {
		return {
			ok: true,
			created: false,
			redirectPath: '/dashboard/manager/add',
			redirectToAdd: true,
			extractDraft: toManagerExtractDraft(payload, threadIdParsed, website)
		};
	}

	const descFields = await resolveGameDescriptionFields({
		description: payload.description,
		autoTranslate: true
	});

	const gameId = randomUUID();
	await db.insert(table.game).values({
		id: gameId,
		name: payload.name,
		description: descFields.description,
		descriptionFr: descFields.descriptionFr,
		website,
		threadId: threadIdParsed,
		tags: payload.tags,
		link: payload.link,
		image: payload.image,
		gameAutoCheck: payload.gameAutoCheck,
		gameVersion: payload.gameVersion,
		createdAt: new Date(),
		updatedAt: new Date()
	});

	return {
		ok: true,
		created: true,
		gameId,
		redirectPath: `/dashboard/game/${gameId}`
	};
}
