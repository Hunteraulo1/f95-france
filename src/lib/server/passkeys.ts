import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function resolveOrigin(requestUrl?: string): URL {
	const fallback = new URL(env.SERVICE_URL_APP?.trim() ?? 'https://f95france.site');

	if (!requestUrl) return fallback;
	try {
		const requested = new URL(requestUrl);
		const requestedOrigin = `${requested.protocol}//${requested.host}`;
		return new URL(requestedOrigin);
	} catch {
		return fallback;
	}
}

export function getRpID(requestUrl?: string): string {
	return resolveOrigin(requestUrl).hostname;
}

export function getExpectedOrigin(requestUrl?: string): string {
	const origin = resolveOrigin(requestUrl);
	return `${origin.protocol}//${origin.host}`;
}

export function getRpName(): string {
	return env.RP_NAME?.trim() || 'F95 France';
}

export function bytesToBase64URL(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString('base64url');
}

export function base64URLToBytes(value: string): Uint8Array {
	return Uint8Array.from(Buffer.from(value, 'base64url'));
}

export async function savePasskeyChallenge(input: {
	userId: string | null;
	type: 'register' | 'login';
	challenge: string;
}): Promise<void> {
	await db.insert(table.passkeyChallenge).values({
		userId: input.userId,
		type: input.type,
		challenge: input.challenge,
		expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
		createdAt: new Date()
	});
}

export async function consumePasskeyChallenge(input: {
	userId: string | null;
	type: 'register' | 'login';
}): Promise<string | null> {
	const now = new Date();
	const whereUser =
		input.userId === null
			? isNull(table.passkeyChallenge.userId)
			: eq(table.passkeyChallenge.userId, input.userId);
	const [row] = await db
		.select({
			id: table.passkeyChallenge.id,
			challenge: table.passkeyChallenge.challenge
		})
		.from(table.passkeyChallenge)
		.where(
			and(
				whereUser,
				eq(table.passkeyChallenge.type, input.type),
				gt(table.passkeyChallenge.expiresAt, now)
			)
		)
		.orderBy(desc(table.passkeyChallenge.createdAt))
		.limit(1);

	if (!row) return null;
	await db.delete(table.passkeyChallenge).where(eq(table.passkeyChallenge.id, row.id));
	return row.challenge;
}
