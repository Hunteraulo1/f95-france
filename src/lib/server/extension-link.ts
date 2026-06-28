import {
	apiKeyIsExtensionScoped,
	createApiKey,
	EXTENSION_API_ROUTE_PREFIX,
	listApiKeysForOwner,
	revokeApiKeyForActor,
	type ApiKeyListRow
} from '$lib/server/api-keys';
import { db } from '$lib/server/db';
import { extensionLinkCode } from '$lib/server/db/schema';
import { and, eq, gt, isNull, lt, or, sql } from 'drizzle-orm';

/** Durée de validité d’un code de liaison. */
export const LINK_CODE_TTL_MS = 5 * 60 * 1000;

/** Fréquence autorisée (req/min) pour une clé d’extension. */
const EXTENSION_KEY_RPM = 30;

/** Libellé des clés frappées par la liaison (le scope est porté par `route_scope`). */
export const EXTENSION_KEY_LABEL = 'Extension navigateur';

/** Une clé API appartient-elle à l’extension (scopée via `route_scope`) ? */
export function isExtensionApiKey(key: Pick<ApiKeyListRow, 'routeScope'>): boolean {
	return apiKeyIsExtensionScoped(key.routeScope);
}

/** Alphabet sans caractères ambigus (0/O, 1/I/L). */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

function randomCode(): string {
	const bytes = new Uint8Array(CODE_LENGTH);
	crypto.getRandomValues(bytes);
	let out = '';
	for (let i = 0; i < CODE_LENGTH; i++) {
		out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
	}
	return out;
}

/**
 * Génère un code de liaison à usage unique (5 min) pour l’utilisateur.
 * Purge au passage les anciens codes (expirés, utilisés ou non) du même compte :
 * un seul code actif à la fois.
 */
export async function createLinkCode(userId: string): Promise<{ code: string; expiresAt: Date }> {
	await db.delete(extensionLinkCode).where(eq(extensionLinkCode.userId, userId));

	const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS);

	// Réessaie en cas (improbable) de collision de clé primaire.
	for (let attempt = 0; attempt < 5; attempt++) {
		const code = randomCode();
		try {
			await db.insert(extensionLinkCode).values({ code, userId, expiresAt });
			return { code, expiresAt };
		} catch (err) {
			if (attempt === 4) throw err;
		}
	}
	throw new Error('Impossible de générer un code de liaison.');
}

export type RedeemLinkCodeResult =
	{ ok: true; rawKey: string; userId: string } | { ok: false; reason: 'invalid' | 'expired' };

/**
 * Échange un code de liaison contre une clé API scopée extension.
 * Marque le code utilisé de façon atomique (un seul échange possible).
 */
export async function redeemLinkCode(rawCode: string): Promise<RedeemLinkCodeResult> {
	const code = rawCode.trim().toUpperCase();
	if (!code) return { ok: false, reason: 'invalid' };

	const [row] = await db
		.select({ userId: extensionLinkCode.userId, expiresAt: extensionLinkCode.expiresAt })
		.from(extensionLinkCode)
		.where(and(eq(extensionLinkCode.code, code), isNull(extensionLinkCode.usedAt)))
		.limit(1);

	if (!row) return { ok: false, reason: 'invalid' };
	if (row.expiresAt.getTime() < Date.now()) {
		return { ok: false, reason: 'expired' };
	}

	const now = new Date();
	const marked = await db
		.update(extensionLinkCode)
		.set({ usedAt: now })
		.where(
			and(
				eq(extensionLinkCode.code, code),
				isNull(extensionLinkCode.usedAt),
				gt(extensionLinkCode.expiresAt, now)
			)
		);

	const consumed = ((marked as unknown as [{ affectedRows: number }])?.[0]?.affectedRows ?? 0) > 0;
	if (!consumed) return { ok: false, reason: 'invalid' };

	const { rawKey } = await createApiKey({
		label: EXTENSION_KEY_LABEL,
		requestsPerMinute: EXTENSION_KEY_RPM,
		expiresAt: null,
		ownerUserId: row.userId,
		createdByUserId: row.userId,
		routeScope: EXTENSION_API_ROUTE_PREFIX
	});

	return { ok: true, rawKey, userId: row.userId };
}

/** Clés d’extension actives (non révoquées) de l’utilisateur. */
export async function listExtensionKeys(userId: string): Promise<ApiKeyListRow[]> {
	const keys = await listApiKeysForOwner(userId);
	return keys.filter((key) => !key.revokedAt && isExtensionApiKey(key));
}

/** L’utilisateur a-t-il au moins une extension liée ? */
export async function isExtensionLinked(userId: string): Promise<boolean> {
	return (await listExtensionKeys(userId)).length > 0;
}

/** Révoque une clé d’extension appartenant à l’utilisateur. */
export async function revokeExtensionKey(
	keyId: string,
	actor: { userId: string; role: string | undefined; permissions?: readonly string[] }
): Promise<boolean> {
	const keys = await listApiKeysForOwner(actor.userId);
	const target = keys.find((key) => key.id === keyId && isExtensionApiKey(key));
	if (!target) return false;
	return revokeApiKeyForActor(keyId, actor);
}

/** Supprime les codes de liaison expirés (maintenance optionnelle). */
export async function purgeExpiredLinkCodes(): Promise<void> {
	await db
		.delete(extensionLinkCode)
		.where(
			or(lt(extensionLinkCode.expiresAt, new Date()), sql`${extensionLinkCode.usedAt} IS NOT NULL`)
		);
}
