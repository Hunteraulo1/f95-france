import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { sha256 } from '@oslojs/crypto/sha2';
import { encodeBase64url, encodeHexLowerCase } from '@oslojs/encoding';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';

const RATE_WINDOW_MS = 60_000;

export const API_KEY_KIND_BEARER = 'bearer';
export const API_KEY_KIND_SESSION = 'session';

/** Nombre maximal de clés actives par compte utilisateur (hors révoquées). */
export const USER_API_KEY_MAX_COUNT = 3;
/** Valeur par défaut (req/min) pour une nouvelle clé côté utilisateur. */
export const USER_API_KEY_DEFAULT_RPM = 30;
/** Plafond de requêtes/minute pour une clé créée par l’utilisateur lui-même. */
export const USER_API_KEY_MAX_RPM = 60;

export function hashApiKeySecret(rawKey: string): string {
	return encodeHexLowerCase(sha256(new TextEncoder().encode(rawKey)));
}

/** Hash synthétique pour la ligne `kind=session` (jamais égal à un vrai secret Bearer). */
export function syntheticSessionKeyHash(ownerUserId: string): string {
	return encodeHexLowerCase(
		sha256(new TextEncoder().encode(`f95fr_session_synthetic_v1:${ownerUserId}`))
	);
}

export function generateApiKeyPlaintext(): { rawKey: string; keyPrefix: string } {
	const bytes = new Uint8Array(24);
	crypto.getRandomValues(bytes);
	const suffix = encodeBase64url(bytes);
	const rawKey = `f95ext_${suffix}`;
	const keyPrefix = rawKey.slice(0, 16);
	return { rawKey, keyPrefix };
}

export function extractApiKeyFromRequest(request: Request): string | null {
	const auth = request.headers.get('authorization');
	if (auth?.toLowerCase().startsWith('bearer ')) {
		const token = auth.slice(7).trim();
		if (token.length > 0) return token;
	}
	const header = request.headers.get('x-api-key')?.trim();
	if (header) return header;
	return null;
}

export type ConsumeApiKeyRateResult = 'ok' | 'rate_limited' | 'quota_disabled';

export async function consumeApiKeyRate(
	apiKeyId: string,
	limitPerMinute: number
): Promise<ConsumeApiKeyRateResult> {
	if (limitPerMinute <= 0) {
		return 'quota_disabled';
	}

	const now = new Date();
	const [row] = await db
		.select()
		.from(table.apiKeyRate)
		.where(eq(table.apiKeyRate.apiKeyId, apiKeyId))
		.limit(1);

	if (!row) {
		await db.insert(table.apiKeyRate).values({
			apiKeyId,
			requestCount: 1,
			windowStartedAt: now
		});
		return 'ok';
	}

	const elapsed = now.getTime() - row.windowStartedAt.getTime();
	if (elapsed >= RATE_WINDOW_MS) {
		await db
			.update(table.apiKeyRate)
			.set({ requestCount: 1, windowStartedAt: now })
			.where(eq(table.apiKeyRate.apiKeyId, apiKeyId));
		return 'ok';
	}

	if (row.requestCount >= limitPerMinute) {
		return 'rate_limited';
	}

	await db
		.update(table.apiKeyRate)
		.set({ requestCount: row.requestCount + 1 })
		.where(eq(table.apiKeyRate.apiKeyId, apiKeyId));
	return 'ok';
}

export type ApiKeyValidateFailure =
	| 'missing'
	| 'invalid'
	| 'expired'
	| 'rate_limited'
	| 'quota_disabled';

/** Valide la clé (hash, révocation, expiration) et le quota ; met à jour `last_used_at`. */
export async function validateApiKeyRequest(
	request: Request
): Promise<
	{ ok: true; keyId: string; ownerUserId: string } | { ok: false; failure: ApiKeyValidateFailure }
> {
	const raw = extractApiKeyFromRequest(request);
	if (!raw) {
		return { ok: false, failure: 'missing' };
	}

	const keyHash = hashApiKeySecret(raw);
	const [row] = await db
		.select()
		.from(table.apiKey)
		.where(and(eq(table.apiKey.keyHash, keyHash), eq(table.apiKey.kind, API_KEY_KIND_BEARER)))
		.limit(1);

	if (!row || row.revokedAt) {
		return { ok: false, failure: 'invalid' };
	}

	if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
		return { ok: false, failure: 'expired' };
	}

	const rate = await consumeApiKeyRate(row.id, row.requestsPerMinute);
	if (rate === 'quota_disabled') {
		return { ok: false, failure: 'quota_disabled' };
	}
	if (rate === 'rate_limited') {
		return { ok: false, failure: 'rate_limited' };
	}

	const touch = new Date();
	await db
		.update(table.apiKey)
		.set({
			lastUsedAt: touch,
			updatedAt: touch,
			totalRequestCount: sql`${table.apiKey.totalRequestCount} + 1`
		})
		.where(eq(table.apiKey.id, row.id));

	return { ok: true, keyId: row.id, ownerUserId: row.ownerUserId };
}

const FAILURE_SPEC: Record<
	ApiKeyValidateFailure,
	{ status: number; body: { error: string }; extraHeaders?: Record<string, string> }
> = {
	missing: {
		status: 401,
		body: {
			error:
				'Authentification requise : session (cookie) ou clé API (Authorization: Bearer … / X-Api-Key).'
		}
	},
	invalid: { status: 401, body: { error: 'Clé API invalide ou révoquée.' } },
	expired: { status: 401, body: { error: 'Clé API expirée.' } },
	rate_limited: {
		status: 429,
		body: {
			error:
				'Limite de fréquence atteinte : vous avez dépassé le nombre de requêtes autorisées par minute pour cette session ou cette clé API. Réessayez dans environ une minute.'
		},
		extraHeaders: { 'retry-after': '60' }
	},
	quota_disabled: {
		status: 403,
		body: {
			error:
				'Accès API suspendu : le quota a été fixé à 0 (blocage côté administration). Il ne s’agit pas d’un simple dépassement de limite minute ; un administrateur doit remonter le quota pour rétablir l’accès.'
		}
	}
};

export function jsonApiKeyGuardResponse(
	failure: ApiKeyValidateFailure,
	cors: Record<string, string>
): Response {
	const spec = FAILURE_SPEC[failure];
	const headers = new Headers({ 'content-type': 'application/json; charset=utf-8' });
	for (const [k, v] of Object.entries(cors)) {
		headers.set(k, v);
	}
	if (spec.extraHeaders) {
		for (const [k, v] of Object.entries(spec.extraHeaders)) {
			headers.set(k, v);
		}
	}
	return new Response(JSON.stringify(spec.body), { status: spec.status, headers });
}

export async function getUserForApiKeyOwner(ownerUserId: string) {
	const [u] = await db.select().from(table.user).where(eq(table.user.id, ownerUserId)).limit(1);
	return u ?? null;
}

export type ApiKeyListRow = {
	id: string;
	keyPrefix: string;
	label: string;
	requestsPerMinute: number;
	expiresAt: Date | null;
	revokedAt: Date | null;
	lastUsedAt: Date | null;
	totalRequestCount: number;
	createdAt: Date;
};

/** Clés actives (non révoquées) d’un utilisateur. */
export async function countActiveApiKeysForOwner(ownerUserId: string): Promise<number> {
	const [row] = await db
		.select({ count: sql<number>`count(*)::int`.as('count') })
		.from(table.apiKey)
		.where(
			and(
				eq(table.apiKey.ownerUserId, ownerUserId),
				isNull(table.apiKey.revokedAt),
				eq(table.apiKey.kind, API_KEY_KIND_BEARER)
			)
		);

	return row?.count ?? 0;
}

export async function listApiKeysForOwner(ownerUserId: string): Promise<ApiKeyListRow[]> {
	return db
		.select({
			id: table.apiKey.id,
			keyPrefix: table.apiKey.keyPrefix,
			label: table.apiKey.label,
			requestsPerMinute: table.apiKey.requestsPerMinute,
			expiresAt: table.apiKey.expiresAt,
			revokedAt: table.apiKey.revokedAt,
			lastUsedAt: table.apiKey.lastUsedAt,
			totalRequestCount: table.apiKey.totalRequestCount,
			createdAt: table.apiKey.createdAt
		})
		.from(table.apiKey)
		.where(
			and(eq(table.apiKey.ownerUserId, ownerUserId), eq(table.apiKey.kind, API_KEY_KIND_BEARER))
		)
		.orderBy(desc(table.apiKey.createdAt));
}

/** Crée la ligne `session` si absente (quota cookie /api/). Idempotent. */
export async function ensureSessionApiKey(ownerUserId: string): Promise<void> {
	const [existing] = await db
		.select({ id: table.apiKey.id })
		.from(table.apiKey)
		.where(
			and(eq(table.apiKey.ownerUserId, ownerUserId), eq(table.apiKey.kind, API_KEY_KIND_SESSION))
		)
		.limit(1);
	if (existing) return;

	const id = crypto.randomUUID();
	const keyHash = syntheticSessionKeyHash(ownerUserId);
	const now = new Date();
	try {
		await db.insert(table.apiKey).values({
			id,
			keyHash,
			keyPrefix: 'session',
			label: 'Session',
			kind: API_KEY_KIND_SESSION,
			requestsPerMinute: USER_API_KEY_DEFAULT_RPM,
			expiresAt: null,
			revokedAt: null,
			lastUsedAt: null,
			ownerUserId,
			createdByUserId: null,
			createdAt: now,
			updatedAt: now
		});
	} catch {
		const [again] = await db
			.select({ id: table.apiKey.id })
			.from(table.apiKey)
			.where(
				and(eq(table.apiKey.ownerUserId, ownerUserId), eq(table.apiKey.kind, API_KEY_KIND_SESSION))
			)
			.limit(1);
		if (!again) throw new Error('ensureSessionApiKey: échec insertion ligne session');
	}
}

export async function getSessionApiKeyRowForOwner(
	ownerUserId: string
): Promise<ApiKeyListRow | null> {
	await ensureSessionApiKey(ownerUserId);
	const [row] = await db
		.select({
			id: table.apiKey.id,
			keyPrefix: table.apiKey.keyPrefix,
			label: table.apiKey.label,
			requestsPerMinute: table.apiKey.requestsPerMinute,
			expiresAt: table.apiKey.expiresAt,
			revokedAt: table.apiKey.revokedAt,
			lastUsedAt: table.apiKey.lastUsedAt,
			totalRequestCount: table.apiKey.totalRequestCount,
			createdAt: table.apiKey.createdAt
		})
		.from(table.apiKey)
		.where(
			and(eq(table.apiKey.ownerUserId, ownerUserId), eq(table.apiKey.kind, API_KEY_KIND_SESSION))
		)
		.limit(1);
	return row ?? null;
}

/** Quota pour les requêtes /api/ authentifiées par cookie (pas par clé). */
export async function consumeSessionApiKeyRateForUser(
	ownerUserId: string
): Promise<{ ok: true } | { ok: false; failure: ApiKeyValidateFailure }> {
	await ensureSessionApiKey(ownerUserId);
	const [row] = await db
		.select({
			id: table.apiKey.id,
			requestsPerMinute: table.apiKey.requestsPerMinute,
			revokedAt: table.apiKey.revokedAt
		})
		.from(table.apiKey)
		.where(
			and(eq(table.apiKey.ownerUserId, ownerUserId), eq(table.apiKey.kind, API_KEY_KIND_SESSION))
		)
		.limit(1);

	if (!row || row.revokedAt) {
		return { ok: false, failure: 'rate_limited' };
	}

	const rate = await consumeApiKeyRate(row.id, row.requestsPerMinute);
	if (rate === 'quota_disabled') {
		return { ok: false, failure: 'quota_disabled' };
	}
	if (rate === 'rate_limited') {
		return { ok: false, failure: 'rate_limited' };
	}

	const touch = new Date();
	await db
		.update(table.apiKey)
		.set({
			lastUsedAt: touch,
			updatedAt: touch,
			totalRequestCount: sql`${table.apiKey.totalRequestCount} + 1`
		})
		.where(eq(table.apiKey.id, row.id));

	return { ok: true };
}

export type ApiKeyAdminRow = ApiKeyListRow & {
	kind: string;
	ownerUserId: string;
	ownerUsername: string;
	ownerEmail: string;
};

export async function listApiKeysForAdmin(): Promise<ApiKeyAdminRow[]> {
	const rows = await db
		.select({
			id: table.apiKey.id,
			keyPrefix: table.apiKey.keyPrefix,
			label: table.apiKey.label,
			kind: table.apiKey.kind,
			requestsPerMinute: table.apiKey.requestsPerMinute,
			expiresAt: table.apiKey.expiresAt,
			revokedAt: table.apiKey.revokedAt,
			lastUsedAt: table.apiKey.lastUsedAt,
			totalRequestCount: table.apiKey.totalRequestCount,
			createdAt: table.apiKey.createdAt,
			ownerUserId: table.apiKey.ownerUserId,
			ownerUsername: table.user.username,
			ownerEmail: table.user.email
		})
		.from(table.apiKey)
		.innerJoin(table.user, eq(table.apiKey.ownerUserId, table.user.id))
		.orderBy(desc(table.apiKey.createdAt));

	return rows;
}

export async function createApiKey(input: {
	label: string;
	requestsPerMinute: number;
	expiresAt: Date | null;
	ownerUserId: string;
	createdByUserId: string;
}): Promise<{ id: string; rawKey: string; keyPrefix: string }> {
	const { rawKey, keyPrefix } = generateApiKeyPlaintext();
	const keyHash = hashApiKeySecret(rawKey);
	const id = crypto.randomUUID();

	await db.insert(table.apiKey).values({
		id,
		keyHash,
		keyPrefix,
		label: input.label,
		kind: API_KEY_KIND_BEARER,
		requestsPerMinute: input.requestsPerMinute,
		expiresAt: input.expiresAt,
		revokedAt: null,
		lastUsedAt: null,
		ownerUserId: input.ownerUserId,
		createdByUserId: input.createdByUserId,
		createdAt: new Date(),
		updatedAt: new Date()
	});

	return { id, rawKey, keyPrefix };
}

export function canManageAllApiKeys(role: string | undefined): boolean {
	return role === 'admin' || role === 'superadmin';
}

export async function revokeApiKeyForActor(
	keyId: string,
	actor: { userId: string; role: string | undefined }
): Promise<boolean> {
	const [meta] = await db
		.select({ kind: table.apiKey.kind })
		.from(table.apiKey)
		.where(eq(table.apiKey.id, keyId))
		.limit(1);
	if (meta?.kind === API_KEY_KIND_SESSION) {
		return false;
	}

	if (canManageAllApiKeys(actor.role)) {
		return revokeApiKey(keyId);
	}

	const touch = new Date();
	const updated = await db
		.update(table.apiKey)
		.set({ revokedAt: touch, updatedAt: touch })
		.where(
			and(
				eq(table.apiKey.id, keyId),
				isNull(table.apiKey.revokedAt),
				eq(table.apiKey.ownerUserId, actor.userId),
				eq(table.apiKey.kind, API_KEY_KIND_BEARER)
			)
		)
		.returning({ id: table.apiKey.id });

	return updated.length > 0;
}

async function revokeApiKey(id: string): Promise<boolean> {
	const [meta] = await db
		.select({ kind: table.apiKey.kind })
		.from(table.apiKey)
		.where(eq(table.apiKey.id, id))
		.limit(1);
	if (meta?.kind === API_KEY_KIND_SESSION) {
		return false;
	}

	const touch = new Date();
	const updated = await db
		.update(table.apiKey)
		.set({ revokedAt: touch, updatedAt: touch })
		.where(
			and(
				eq(table.apiKey.id, id),
				isNull(table.apiKey.revokedAt),
				eq(table.apiKey.kind, API_KEY_KIND_BEARER)
			)
		)
		.returning({ id: table.apiKey.id });

	return updated.length > 0;
}

export async function updateApiKeyLimitsAdmin(
	keyId: string,
	input: { requestsPerMinute: number; expiresAt: Date | null }
): Promise<boolean> {
	const [row] = await db
		.select({ kind: table.apiKey.kind })
		.from(table.apiKey)
		.where(eq(table.apiKey.id, keyId))
		.limit(1);
	const expiresAt = row?.kind === API_KEY_KIND_SESSION ? null : input.expiresAt;

	const touch = new Date();
	const updated = await db
		.update(table.apiKey)
		.set({
			requestsPerMinute: input.requestsPerMinute,
			expiresAt,
			updatedAt: touch
		})
		.where(and(eq(table.apiKey.id, keyId), isNull(table.apiKey.revokedAt)))
		.returning({ id: table.apiKey.id });

	return updated.length > 0;
}
