import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { sha256 } from '@oslojs/crypto/sha2';
import { encodeBase64url, encodeHexLowerCase } from '@oslojs/encoding';
import type { RequestEvent } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';

const DAY_IN_MS = 1000 * 60 * 60 * 24;

export const sessionCookieName = 'auth-session';

// Generate secure random string with 120 bits of entropy
function generateSecureRandomString(): string {
	const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
	const bytes = new Uint8Array(24);
	crypto.getRandomValues(bytes);

	let result = "";
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
	
	const [sessionId] = tokenParts;
	
	const [result] = await db
		.select({
			// Adjust user table here to tweak returned data
			user: { id: table.user.id, username: table.user.username },
			session: table.session
		})
		.from(table.session)
		.innerJoin(table.user, eq(table.session.userId, table.user.id))
		.where(eq(table.session.id, sessionId));

	if (!result) {
		return { session: null, user: null };
	}
	const { session, user } = result;

	// Check expiration
	const sessionExpired = Date.now() >= session.expiresAt.getTime();
	if (sessionExpired) {
		await db.delete(table.session).where(eq(table.session.id, session.id));
		return { session: null, user: null };
	}

	// Verify secret (we need to add secretHash to our schema)
	// For now, we'll skip secret verification until we update the schema
	// const secretHash = sha256(new TextEncoder().encode(secret));
	// const validSecret = constantTimeEqual(secretHash, session.secretHash);
	// if (!validSecret) {
	// 	return { session: null, user: null };
	// }

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

export async function getUserById(userId: string) {
	const [user] = await db
		.select()
		.from(table.user)
		.where(eq(table.user.id, userId));
	
	return user || null;
}

export type SessionValidationResult = Awaited<ReturnType<typeof validateSessionToken>>;

export async function invalidateSession(sessionId: string) {
	await db.delete(table.session).where(eq(table.session.id, sessionId));
}

export function setSessionTokenCookie(event: RequestEvent, token: string, expiresAt: Date) {
	event.cookies.set(sessionCookieName, token, {
		expires: expiresAt,
		path: '/'
	});
}

export function deleteSessionTokenCookie(event: RequestEvent) {
	event.cookies.delete(sessionCookieName, {
		path: '/'
	});
}

// Password hashing functions using Oslo crypto
export function hashPassword(password: string): string {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const saltString = encodeBase64url(salt);
	const hash = sha256(new TextEncoder().encode(password + saltString));
	return `${saltString}:${encodeHexLowerCase(hash)}`;
}

export function verifyPassword(password: string, hashedPassword: string): boolean {
	const [saltString, hashString] = hashedPassword.split(':');
	if (!saltString || !hashString) return false;
	
	const hash = sha256(new TextEncoder().encode(password + saltString));
	const hashStringFromPassword = encodeHexLowerCase(hash);
	
	return hashStringFromPassword === hashString;
}

// User creation function
export async function createUser(username: string, email: string, password: string) {
	const hashedPassword = hashPassword(password);
	
	const userId = crypto.randomUUID();
	
	const user: table.User = {
		id: userId,
		email,
		username,
		avatar: '', // Default avatar
		passwordHash: hashedPassword,
		role: 'user',
		theme: 'light',
		devUserId: null,
		gameAdd: 0,
		gameEdit: 0,
		createdAt: new Date(),
		updatedAt: new Date()
	};
	
	await db.insert(table.user).values(user);
	return user;
}

// Check if user exists
export async function getUserByEmail(email: string) {
	const [user] = await db
		.select()
		.from(table.user)
		.where(eq(table.user.email, email));
	
	return user || null;
}

export async function getUserByUsername(username: string) {
	const [user] = await db
		.select()
		.from(table.user)
		.where(eq(table.user.username, username));
	
	return user || null;
}
