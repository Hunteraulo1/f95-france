import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { getRpID, getRpName, savePasskeyChallenge } from '$lib/server/passkeys';
import {
	generateRegistrationOptions,
	type PublicKeyCredentialCreationOptionsJSON
} from '@simplewebauthn/server';
import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

const serviceUnavailable = () =>
	json(
		{
			error:
				'Service temporairement indisponible (base de données ou serveur). Réessayez dans quelques instants.'
		},
		{ status: 503 }
	);

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		return json({ error: 'Non authentifié' }, { status: 401 });
	}

	try {
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
	} catch (error) {
		console.error('[api/passkeys/register/options]', error);
		return serviceUnavailable();
	}
};
