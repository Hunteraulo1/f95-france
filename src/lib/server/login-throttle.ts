import { getRequestClientAddressOrUnknown } from '$lib/server/client-address';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import type { RequestEvent } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';

/** Fenêtre glissante : après N échecs, blocage pendant LOCK_MS. */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;
const LOCK_MS = 15 * 60 * 1000;

function clientKey(event: RequestEvent): string {
	return getRequestClientAddressOrUnknown(event);
}

function scopedClientKey(event: RequestEvent, scope: string): string {
	return `${scope}:${clientKey(event)}`;
}

export const LOGIN_THROTTLE_MESSAGE =
	'Trop de tentatives de connexion. Réessayez dans quelques minutes.';

export async function checkLoginThrottle(
	event: RequestEvent
): Promise<{ ok: true } | { ok: false; message: string }> {
	const key = clientKey(event);
	const [row] = await db
		.select()
		.from(table.loginThrottle)
		.where(eq(table.loginThrottle.clientKey, key))
		.limit(1);

	if (row?.lockedUntil && row.lockedUntil.getTime() > Date.now()) {
		return { ok: false, message: LOGIN_THROTTLE_MESSAGE };
	}
	return { ok: true };
}

export async function recordLoginFailure(event: RequestEvent): Promise<void> {
	const key = clientKey(event);
	const now = new Date();
	const [row] = await db
		.select()
		.from(table.loginThrottle)
		.where(eq(table.loginThrottle.clientKey, key))
		.limit(1);

	if (!row) {
		await db.insert(table.loginThrottle).values({
			clientKey: key,
			failedCount: 1,
			windowStartedAt: now,
			lockedUntil: null
		});
		return;
	}

	if (row.lockedUntil && row.lockedUntil.getTime() > Date.now()) {
		return;
	}

	let failedCount: number;
	let windowStartedAt: Date;
	let lockedUntil: Date | null = null;

	if (now.getTime() - row.windowStartedAt.getTime() > WINDOW_MS) {
		failedCount = 1;
		windowStartedAt = now;
	} else {
		failedCount = row.failedCount + 1;
		windowStartedAt = row.windowStartedAt;
	}

	if (failedCount >= MAX_FAILURES) {
		lockedUntil = new Date(now.getTime() + LOCK_MS);
	}

	await db
		.update(table.loginThrottle)
		.set({
			failedCount,
			windowStartedAt,
			lockedUntil
		})
		.where(eq(table.loginThrottle.clientKey, key));
}

export async function clearLoginThrottle(event: RequestEvent): Promise<void> {
	const key = clientKey(event);
	await db.delete(table.loginThrottle).where(eq(table.loginThrottle.clientKey, key));
}

/** Captcha requis après au moins une tentative de connexion échouée (même IP). */
export async function loginRequiresCaptcha(event: RequestEvent): Promise<boolean> {
	const key = clientKey(event);
	const [row] = await db
		.select({ failedCount: table.loginThrottle.failedCount })
		.from(table.loginThrottle)
		.where(eq(table.loginThrottle.clientKey, key))
		.limit(1);

	return (row?.failedCount ?? 0) > 0;
}

export const PASSKEY_REGISTER_THROTTLE_MESSAGE =
	'Trop de tentatives d’enregistrement de clé d’accès. Réessayez dans quelques minutes.';

/** Limite les appels à `/api/passkeys/register/options` (par IP). */
export async function checkPasskeyRegisterThrottle(
	event: RequestEvent
): Promise<{ ok: true } | { ok: false; message: string }> {
	const key = scopedClientKey(event, 'passkey-register');
	const [row] = await db
		.select()
		.from(table.loginThrottle)
		.where(eq(table.loginThrottle.clientKey, key))
		.limit(1);

	if (row?.lockedUntil && row.lockedUntil.getTime() > Date.now()) {
		return { ok: false, message: PASSKEY_REGISTER_THROTTLE_MESSAGE };
	}
	return { ok: true };
}

export async function recordPasskeyRegisterAttempt(event: RequestEvent): Promise<void> {
	const key = scopedClientKey(event, 'passkey-register');
	const now = new Date();
	const [row] = await db
		.select()
		.from(table.loginThrottle)
		.where(eq(table.loginThrottle.clientKey, key))
		.limit(1);

	const MAX_ATTEMPTS = 20;
	const LOCK_MS = 15 * 60 * 1000;
	const WINDOW_MS = 15 * 60 * 1000;

	if (!row) {
		await db.insert(table.loginThrottle).values({
			clientKey: key,
			failedCount: 1,
			windowStartedAt: now,
			lockedUntil: null
		});
		return;
	}

	if (row.lockedUntil && row.lockedUntil.getTime() > Date.now()) {
		return;
	}

	let failedCount: number;
	let windowStartedAt: Date;
	let lockedUntil: Date | null = null;

	if (now.getTime() - row.windowStartedAt.getTime() > WINDOW_MS) {
		failedCount = 1;
		windowStartedAt = now;
	} else {
		failedCount = row.failedCount + 1;
		windowStartedAt = row.windowStartedAt;
	}

	if (failedCount >= MAX_ATTEMPTS) {
		lockedUntil = new Date(now.getTime() + LOCK_MS);
	}

	await db
		.update(table.loginThrottle)
		.set({
			failedCount,
			windowStartedAt,
			lockedUntil
		})
		.where(eq(table.loginThrottle.clientKey, key));
}
