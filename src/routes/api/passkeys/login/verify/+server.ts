import * as auth from '$lib/server/auth';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import {
	base64URLToBytes,
	consumePasskeyChallenge,
	getExpectedOrigin,
	getRpID
} from '$lib/server/passkeys';
import { json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import {
	verifyAuthenticationResponse,
	type AuthenticationResponseJSON
} from '@simplewebauthn/server';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const { request } = event;
	const body = (await request.json()) as { username?: string; response?: AuthenticationResponseJSON };
	const username = body.username?.trim();
	if (!username) {
		return json({ error: "Le nom d'utilisateur est requis." }, { status: 400 });
	}
	if (!body.response) {
		return json({ error: 'Réponse WebAuthn manquante.' }, { status: 400 });
	}

	const [user] = await db
		.select({
			id: table.user.id,
			username: table.user.username
		})
		.from(table.user)
		.where(eq(table.user.username, username))
		.limit(1);
	if (!user) {
		return json({ error: 'Utilisateur introuvable.' }, { status: 404 });
	}

	const expectedChallenge = await consumePasskeyChallenge({
		userId: user.id,
		type: 'login'
	});
	if (!expectedChallenge) {
		return json({ error: 'Challenge expiré, recommencez la connexion.' }, { status: 400 });
	}

	const [stored] = await db
		.select({
			id: table.passkey.id,
			credentialId: table.passkey.credentialId,
			publicKey: table.passkey.publicKey,
			counter: table.passkey.counter
		})
		.from(table.passkey)
		.where(and(eq(table.passkey.userId, user.id), eq(table.passkey.credentialId, body.response.id)))
		.limit(1);
	if (!stored) {
		return json({ error: "Cette clé d'accès n'est pas enregistrée pour ce compte." }, { status: 400 });
	}

	const verification = await verifyAuthenticationResponse({
		response: body.response,
		expectedChallenge,
		expectedOrigin: getExpectedOrigin(),
		expectedRPID: getRpID(),
		requireUserVerification: true,
		credential: {
			id: stored.credentialId,
			publicKey: new Uint8Array(base64URLToBytes(stored.publicKey)) as Uint8Array<ArrayBuffer>,
			counter: stored.counter
		}
	});

	if (!verification.verified) {
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
	const session = await auth.createSession(sessionToken, user.id);
	auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);

	return json({ success: true });
};
