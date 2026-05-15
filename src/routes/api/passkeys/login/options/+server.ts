import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { getRpID, savePasskeyChallenge } from '$lib/server/passkeys';
import {
	generateAuthenticationOptions,
	type PublicKeyCredentialRequestOptionsJSON
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

export const POST: RequestHandler = async ({ request }) => {
	let body: { username?: string };
	try {
		body = (await request.json()) as { username?: string };
	} catch {
		return json({ error: 'Requête JSON invalide.' }, { status: 400 });
	}

	try {
		const username = body.username?.trim();
		if (username) {
			const [user] = await db
				.select({ id: table.user.id })
				.from(table.user)
				.where(eq(table.user.username, username))
				.limit(1);

			if (!user) {
				return json({ error: 'Utilisateur introuvable.' }, { status: 404 });
			}

			const passkeys = await db
				.select({
					credentialId: table.passkey.credentialId
				})
				.from(table.passkey)
				.where(eq(table.passkey.userId, user.id));

			if (passkeys.length === 0) {
				return json({ error: "Aucune clé d'accès enregistrée pour ce compte." }, { status: 400 });
			}

			const options: PublicKeyCredentialRequestOptionsJSON = await generateAuthenticationOptions({
				rpID: getRpID(request.url),
				userVerification: 'preferred',
				allowCredentials: passkeys.map((p) => ({
					id: p.credentialId
				}))
			});

			await savePasskeyChallenge({
				userId: user.id,
				type: 'login',
				challenge: options.challenge
			});

			return json({ options });
		}

		// Username optionnel: support des passkeys discoverable (resident credentials).
		const options: PublicKeyCredentialRequestOptionsJSON = await generateAuthenticationOptions({
			rpID: getRpID(request.url),
			userVerification: 'preferred'
		});
		await savePasskeyChallenge({
			userId: null,
			type: 'login',
			challenge: options.challenge
		});
		return json({ options });
	} catch (error) {
		console.error('[api/passkeys/login/options]', error);
		return serviceUnavailable();
	}
};
