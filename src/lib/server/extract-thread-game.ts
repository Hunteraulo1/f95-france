import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { resolveGameAutoCheckForWebsite } from '$lib/server/game-auto-check';
import { createGameUpdateRow } from '$lib/server/game-updates';
import { and, eq, sql } from 'drizzle-orm';

/** Sites supportés par `/api/extract/{f95|lc}/[threadId]`. */
export type ExtractThreadWebsite = 'f95z' | 'lc';

const SITE_META: Record<
	ExtractThreadWebsite,
	{
		defaultLink: (threadId: number) => string;
		defaultName: (threadId: number) => string;
		imageSeed: string;
	}
> = {
	f95z: {
		defaultLink: (tid) => `https://f95zone.to/threads/${tid}`,
		defaultName: (tid) => `F95 #${tid}`,
		imageSeed: 'f95-extract'
	},
	lc: {
		defaultLink: (tid) => `https://lewdcorner.com/threads/${tid}`,
		defaultName: (tid) => `LC #${tid}`,
		imageSeed: 'lc-extract'
	}
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
		'Access-Control-Allow-Headers': 'Content-Type'
	};

	// `vite dev` : requêtes cross-origin (Tampermonkey sur F95/LC → localhost) sans EXTRACT_* en .env.
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

function isAdmin(locals: App.Locals): boolean {
	const r = locals.user?.role;
	return r === 'admin' || r === 'superadmin';
}

/** Champs optionnels (même sémantique que le JSON POST) via query string pour un script public : ouvrir l’URL en navigation top-level (cookie session Lax envoyé). */
function payloadFromSearchParams(url: URL): Record<string, unknown> {
	const sp = url.searchParams;
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

export type ExtractThreadResult =
	| { ok: true; created: boolean; gameId: string; redirectPath: string }
	| { ok: false; status: number; body: Record<string, unknown> };

export async function runExtractThreadGame(input: {
	locals: App.Locals;
	threadIdParam: string | undefined;
	method: string;
	request: Request;
	website: ExtractThreadWebsite;
}): Promise<ExtractThreadResult> {
	const { locals, threadIdParam, method, request, website } = input;
	const meta = SITE_META[website];

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
	if (!isAdmin(locals)) {
		return { ok: false, status: 403, body: { error: 'Accès réservé aux administrateurs' } };
	}

	const threadIdParsed = Number.parseInt(String(threadIdParam ?? ''), 10);
	if (!Number.isFinite(threadIdParsed) || threadIdParsed <= 0) {
		return { ok: false, status: 400, body: { error: 'ID de thread invalide' } };
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
				sql`(data::jsonb->'game'->>'threadId') IS NOT NULL AND (data::jsonb->'game'->>'threadId')::int = ${threadIdParsed}`,
				sql`(data::jsonb->'game'->>'website') = ${website}`
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

	let body: Record<string, unknown> = {};
	if (method === 'POST') {
		const text = await request.text();
		if (text.trim()) {
			try {
				body = JSON.parse(text) as Record<string, unknown>;
			} catch {
				return { ok: false, status: 400, body: { error: 'Corps JSON invalide' } };
			}
		}
	} else if (method === 'GET') {
		body = payloadFromSearchParams(new URL(request.url));
	}

	const name =
		typeof body.name === 'string' && body.name.trim()
			? clampStr(body.name.trim(), 255)
			: meta.defaultName(threadIdParsed);

	const link =
		typeof body.link === 'string' && body.link.trim()
			? clampStr(body.link.trim(), 500)
			: meta.defaultLink(threadIdParsed);

	const tags = typeof body.tags === 'string' ? clampStr(body.tags.trim(), 20_000) : '';

	const image =
		typeof body.image === 'string' && body.image.trim()
			? clampStr(body.image.trim(), 500)
			: `https://picsum.photos/seed/${meta.imageSeed}/400/225`;

	const description =
		typeof body.description === 'string' && body.description.trim()
			? body.description.trim().slice(0, 100_000)
			: null;

	const gameVersion =
		typeof body.gameVersion === 'string' && body.gameVersion.trim()
			? clampStr(body.gameVersion.trim(), 100)
			: null;

	const gameAutoCheck = resolveGameAutoCheckForWebsite(
		website,
		typeof body.gameAutoCheck === 'boolean' ? body.gameAutoCheck : undefined,
		true
	);

	const [inserted] = await db
		.insert(table.game)
		.values({
			name,
			description,
			website,
			threadId: threadIdParsed,
			tags,
			link,
			image,
			gameAutoCheck,
			gameVersion,
			createdAt: new Date(),
			updatedAt: new Date()
		})
		.returning({ id: table.game.id });

	const gameId = inserted?.id;
	if (!gameId) {
		return { ok: false, status: 500, body: { error: 'Création du jeu échouée' } };
	}

	await createGameUpdateRow(gameId, 'adding');

	return {
		ok: true,
		created: true,
		gameId,
		redirectPath: `/dashboard/game/${gameId}`
	};
}
