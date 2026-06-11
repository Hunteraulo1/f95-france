import { appLogError } from '$lib/server/app-log-bridge';
import { secureSessionCookieOptions } from '$lib/server/cookie-options';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { generateEmailUnsubscribeToken } from '$lib/server/email-verification';
import {
	hashPassword,
	hashSessionSecret,
	verifySessionSecret,
	type PasswordVerifyResult
} from '$lib/server/password-hash';
import { encodeBase64url } from '@oslojs/encoding';
import type { RequestEvent } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';

const DAY_IN_MS = 1000 * 60 * 60 * 24;

export const sessionCookieName = 'auth-session';

export {
	hashPassword,
	INVALID_CREDENTIALS_MESSAGE,
	verifyPassword
} from '$lib/server/password-hash';
export type { PasswordVerifyResult };

function generateSecureRandomString(): string {
	const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
	const bytes = new Uint8Array(24);
	crypto.getRandomValues(bytes);

	let result = '';
	for (let i = 0; i < bytes.length; i++) {
		result += alphabet[bytes[i] >> 3];
	}
	return result;
}

export function generateSessionToken() {
	const id = generateSecureRandomString();
	const secret = generateSecureRandomString();
	return `${id}.${secret}`;
}

export async function createSession(token: string, userId: string) {
	const [sessionId, secret] = token.split('.');
	if (!sessionId || !secret) {
		throw new Error('Invalid session token format');
	}

	const session: table.Session = {
		id: sessionId,
		secretHash: hashSessionSecret(secret),
		userId,
		expiresAt: new Date(Date.now() + DAY_IN_MS * 30)
	};
	await db.insert(table.session).values(session);
	return session;
}

export async function validateSessionToken(token: string) {
	const tokenParts = token.split('.');
	if (tokenParts.length !== 2) {
		return { session: null, user: null };
	}

	const [sessionId, secret] = tokenParts;
	if (!sessionId || !secret) {
		return { session: null, user: null };
	}

	const [result] = await db
		.select({
			user: table.user,
			session: table.session
		})
		.from(table.session)
		.innerJoin(table.user, eq(table.session.userId, table.user.id))
		.where(eq(table.session.id, sessionId));

	if (!result) {
		return { session: null, user: null };
	}
	const { session, user } = result;

	const sessionExpired = Date.now() >= session.expiresAt.getTime();
	if (sessionExpired) {
		await db.delete(table.session).where(eq(table.session.id, session.id));
		return { session: null, user: null };
	}

	if (!verifySessionSecret(secret, session.secretHash)) {
		await db.delete(table.session).where(eq(table.session.id, session.id));
		return { session: null, user: null };
	}

	const renewSession = Date.now() >= session.expiresAt.getTime() - DAY_IN_MS * 15;
	if (renewSession) {
		session.expiresAt = new Date(Date.now() + DAY_IN_MS * 30);
		await db
			.update(table.session)
			.set({ expiresAt: session.expiresAt })
			.where(eq(table.session.id, session.id));
	}

	return { session, user };
}

export async function validateSessionTokenWithRetry(
	token: string,
	options?: { retries?: number; delayMs?: number }
): Promise<SessionValidationResult> {
	const retries = options?.retries ?? 2;
	const delayMs = options?.delayMs ?? 80;
	let lastError: unknown;
	for (let attempt = 0; attempt <= retries; attempt++) {
		try {
			return await validateSessionToken(token);
		} catch (e) {
			lastError = e;
			if (attempt < retries) {
				await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
			}
		}
	}
	appLogError('auth', 'validateSessionToken : échec après réessais', lastError);
	throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function getUserById(userId: string) {
	const [user] = await db.select().from(table.user).where(eq(table.user.id, userId));

	return user || null;
}

export type SessionValidationResult = Awaited<ReturnType<typeof validateSessionToken>>;

export async function invalidateSession(sessionId: string) {
	await db.delete(table.session).where(eq(table.session.id, sessionId));
}

export function setSessionTokenCookie(event: RequestEvent, token: string, expiresAt: Date) {
	event.cookies.set(sessionCookieName, token, {
		...secureSessionCookieOptions(event),
		expires: expiresAt
	});
}

export function deleteSessionTokenCookie(event: RequestEvent) {
	event.cookies.delete(sessionCookieName, secureSessionCookieOptions(event));
}

export async function createUser(username: string, email: string, password: string) {
	const hashedPassword = await hashPassword(password);

	const userId = crypto.randomUUID();
	const emailUnsubscribeToken = generateEmailUnsubscribeToken();

	const user: table.User = {
		id: userId,
		email,
		username,
		discordId: null,
		avatar: '',
		passwordHash: hashedPassword,
		hasPassword: true,
		twoFactorEnabled: false,
		twoFactorSecret: null,
		role: 'user',
		theme: 'system',
		directMode: true,
		devUserId: null,
		gameAdd: 0,
		gameEdit: 0,
		profileBio: null,
		profileBackgroundUrl: null,
		profileMusicUrl: null,
		profileCursorUrl: null,
		savedGamesFilters: '[]',
		savedUpdatesFilters: '[]',
		emailVerifiedAt: null,
		emailUnsubscribeToken,
		emailMarketingOptOut: false,
		lastSeenAt: null,
		createdAt: new Date(),
		updatedAt: new Date()
	};

	await db.insert(table.user).values(user);
	return user;
}

export async function getUserByEmail(email: string) {
	const [user] = await db.select().from(table.user).where(eq(table.user.email, email));

	return user || null;
}

export async function getUserByDiscordId(discordId: string) {
	const [user] = await db.select().from(table.user).where(eq(table.user.discordId, discordId));
	return user ?? null;
}

export async function createUserFromDiscord(params: {
	username: string;
	email: string;
	discordId: string;
	avatar?: string;
	emailVerifiedAt?: Date | null;
}) {
	const oauthSecret = encodeBase64url(randomBytes(32));
	const hashedPassword = await hashPassword(oauthSecret);
	const userId = crypto.randomUUID();
	const emailUnsubscribeToken = generateEmailUnsubscribeToken();

	const user: table.User = {
		id: userId,
		email: params.email,
		username: params.username,
		discordId: params.discordId,
		avatar: params.avatar ?? '',
		passwordHash: hashedPassword,
		hasPassword: false,
		twoFactorEnabled: false,
		twoFactorSecret: null,
		role: 'user',
		theme: 'system',
		directMode: true,
		devUserId: null,
		gameAdd: 0,
		gameEdit: 0,
		profileBio: null,
		profileBackgroundUrl: null,
		profileMusicUrl: null,
		profileCursorUrl: null,
		savedGamesFilters: '[]',
		savedUpdatesFilters: '[]',
		emailVerifiedAt: params.emailVerifiedAt ?? null,
		emailUnsubscribeToken,
		emailMarketingOptOut: false,
		lastSeenAt: null,
		createdAt: new Date(),
		updatedAt: new Date()
	};

	await db.insert(table.user).values(user);
	return user;
}

export async function signInUserAndGetDestination(
	event: RequestEvent,
	user: Pick<table.User, 'id' | 'emailVerifiedAt'>,
	redirectTo: string
) {
	const sessionToken = generateSessionToken();
	const session = await createSession(sessionToken, user.id);
	setSessionTokenCookie(event, sessionToken, session.expiresAt);

	const { clearLoginThrottle } = await import('$lib/server/login-throttle');
	await clearLoginThrottle(event);

	const { dashboardVerifyEmailPath, emailVerificationRequired, isUserEmailVerified } =
		await import('$lib/server/email-verification');

	let destination = redirectTo;
	if (
		emailVerificationRequired() &&
		!isUserEmailVerified(user) &&
		destination !== dashboardVerifyEmailPath()
	) {
		destination = dashboardVerifyEmailPath();
	}

	return destination;
}

export async function getUserByUsername(username: string) {
	const [user] = await db.select().from(table.user).where(eq(table.user.username, username));

	return user || null;
}

/** Met à jour le hash si l’ancien format (SHA-256) a été utilisé à la connexion. */
export async function rehashPasswordIfNeeded(userId: string, password: string): Promise<void> {
	const nextHash = await hashPassword(password);
	await db
		.update(table.user)
		.set({ passwordHash: nextHash, updatedAt: new Date() })
		.where(eq(table.user.id, userId));
}
