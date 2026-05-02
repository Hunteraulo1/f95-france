import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { getRpID, getRpName, savePasskeyChallenge } from '$lib/server/passkeys';
import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import {
	generateRegistrationOptions,
	type PublicKeyCredentialCreationOptionsJSON
} from '@simplewebauthn/server';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		return json({ error: 'Non authentifié' }, { status: 401 });
	}

	const passkeys = await db
		.select({
			credentialId: table.passkey.credentialId,
			transports: table.passkey.transports
		})
		.from(table.passkey)
		.where(eq(table.passkey.userId, locals.user.id));

	const options: PublicKeyCredentialCreationOptionsJSON = await generateRegistrationOptions({
		rpName: getRpName(),
		rpID: getRpID(request.url),
		userName: locals.user.username,
		userID: new TextEncoder().encode(locals.user.id),
		attestationType: 'none',
		authenticatorSelection: {
			residentKey: 'preferred',
			userVerification: 'preferred'
		},
		excludeCredentials: passkeys.map((p) => ({
			id: p.credentialId
		}))
	});

	await savePasskeyChallenge({
		userId: locals.user.id,
		type: 'register',
		challenge: options.challenge
	});

	return json({ options });
};
