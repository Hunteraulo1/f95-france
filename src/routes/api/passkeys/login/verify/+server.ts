import * as auth from '$lib/server/auth';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import {
    checkLoginThrottle,
    clearLoginThrottle,
    LOGIN_THROTTLE_MESSAGE,
    recordLoginFailure
} from '$lib/server/login-throttle';
import {
    base64URLToBytes,
    consumePasskeyChallenge,
    getExpectedOrigin,
    getRpID
} from '$lib/server/passkeys';
import {
    verifyAuthenticationResponse,
    type AuthenticationResponseJSON
} from '@simplewebauthn/server';
import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const { request } = event;
	const body = (await request.json()) as {
		username?: string;
		response?: AuthenticationResponseJSON;
	};
	const username = body.username?.trim();
	if (!body.response) {
		return json({ error: 'Réponse WebAuthn manquante.' }, { status: 400 });
	}

	const throttle = await checkLoginThrottle(event);
	if (!throttle.ok) {
		return json({ error: LOGIN_THROTTLE_MESSAGE }, { status: 429 });
	}

	const [stored] = await db
		.select({
			id: table.passkey.id,
			userId: table.passkey.userId,
			credentialId: table.passkey.credentialId,
			publicKey: table.passkey.publicKey,
			counter: table.passkey.counter,
			username: table.user.username
		})
		.from(table.passkey)
		.innerJoin(table.user, eq(table.passkey.userId, table.user.id))
		.where(eq(table.passkey.credentialId, body.response.id))
		.limit(1);
	if (!stored) {
		await recordLoginFailure(event);
		return json({ error: "Cette clé d'accès n'est pas enregistrée." }, { status: 400 });
	}
	if (username && stored.username !== username) {
		await recordLoginFailure(event);
		return json(
			{ error: "Cette clé d'accès n'appartient pas à cet utilisateur." },
			{ status: 400 }
		);
	}

	const expectedChallenge = await consumePasskeyChallenge({
		userId: username ? stored.userId : null,
		type: 'login'
	});
	if (!expectedChallenge) {
		await recordLoginFailure(event);
		return json({ error: 'Challenge expiré, recommencez la connexion.' }, { status: 400 });
	}

	const verification = await verifyAuthenticationResponse({
		response: body.response,
		expectedChallenge,
		expectedOrigin: getExpectedOrigin(request.url),
		expectedRPID: getRpID(request.url),
		requireUserVerification: true,
		credential: {
			id: stored.credentialId,
			publicKey: new Uint8Array(base64URLToBytes(stored.publicKey)) as Uint8Array<ArrayBuffer>,
			counter: stored.counter
		}
	});

	if (!verification.verified) {
		await recordLoginFailure(event);
		return json({ error: "Échec de vérification de la clé d'accès." }, { status: 400 });
	}

	await db
		.update(table.passkey)
		.set({
			counter: verification.authenticationInfo.newCounter,
			lastUsedAt: new Date()
		})
		.where(eq(table.passkey.id, stored.id));

	const sessionToken = auth.generateSessionToken();
	const session = await auth.createSession(sessionToken, stored.userId);
	auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);
	await clearLoginThrottle(event);

	return json({ success: true });
};
