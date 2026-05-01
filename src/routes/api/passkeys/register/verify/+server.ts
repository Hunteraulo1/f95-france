import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import {
	bytesToBase64URL,
	consumePasskeyChallenge,
	getExpectedOrigin,
	getRpID
} from '$lib/server/passkeys';
import { json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import {
	verifyRegistrationResponse,
	type RegistrationResponseJSON
} from '@simplewebauthn/server';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		return json({ error: 'Non authentifié' }, { status: 401 });
	}

	const body = (await request.json()) as { response?: RegistrationResponseJSON };
	if (!body.response) {
		return json({ error: 'Réponse WebAuthn manquante' }, { status: 400 });
	}

	const expectedChallenge = await consumePasskeyChallenge({
		userId: locals.user.id,
		type: 'register'
	});
	if (!expectedChallenge) {
		return json({ error: 'Challenge expiré, relancez la configuration.' }, { status: 400 });
	}

	const verification = await verifyRegistrationResponse({
		response: body.response,
		expectedChallenge,
		expectedOrigin: getExpectedOrigin(request.url),
		expectedRPID: getRpID(request.url),
		requireUserVerification: true
	});

	if (!verification.verified || !verification.registrationInfo) {
		return json({ error: "Impossible de valider la clé d'accès." }, { status: 400 });
	}

	const credentialId = body.response.id;
	const existing = await db
		.select({ id: table.passkey.id })
		.from(table.passkey)
		.where(and(eq(table.passkey.userId, locals.user.id), eq(table.passkey.credentialId, credentialId)))
		.limit(1);
	if (existing[0]) {
		return json({ success: true, message: 'Cette clé est déjà enregistrée.' });
	}

	await db.insert(table.passkey).values({
		userId: locals.user.id,
		credentialId,
		publicKey: bytesToBase64URL(verification.registrationInfo.credential.publicKey),
		counter: verification.registrationInfo.credential.counter,
		transports: body.response.response.transports
			? JSON.stringify(body.response.response.transports)
			: null,
		createdAt: new Date(),
		lastUsedAt: null
	});

	return json({ success: true, message: "Clé d'accès enregistrée." });
};
