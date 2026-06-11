import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import {
	checkLoginThrottle,
	loginRequiresCaptcha,
	recordLoginFailure
} from '$lib/server/login-throttle';
import { getRpID, savePasskeyChallenge } from '$lib/server/passkeys';
import { extractTurnstileTokenFromJson, verifyTurnstileFromForm } from '$lib/server/turnstile';
import {
	generateAuthenticationOptions,
	type PublicKeyCredentialRequestOptionsJSON
} from '@simplewebauthn/server';
import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

const PASSKEY_LOGIN_FAILURE_MESSAGE = 'Connexion par clé d’accès impossible avec ces informations.';

const serviceUnavailable = () =>
	json(
		{
			error:
				'Service temporairement indisponible (base de données ou serveur). Réessayez dans quelques instants.'
		},
		{ status: 503 }
	);

export const POST: RequestHandler = async (event) => {
	const throttle = await checkLoginThrottle(event);
	if (!throttle.ok) {
		return json({ error: throttle.message }, { status: 429 });
	}

	let body: { username?: string };
	try {
		body = (await event.request.json()) as { username?: string } & Record<string, unknown>;
	} catch {
		return json({ error: 'Requête JSON invalide.' }, { status: 400 });
	}

	if (await loginRequiresCaptcha(event)) {
		const captcha = await verifyTurnstileFromForm(event, extractTurnstileTokenFromJson(body));
		if (!captcha.ok) {
			return json({ error: captcha.message, requiresCaptcha: true }, { status: 400 });
		}
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
				await recordLoginFailure(event);
				return json(
					{ error: PASSKEY_LOGIN_FAILURE_MESSAGE, requiresCaptcha: true },
					{ status: 400 }
				);
			}

			const passkeys = await db
				.select({
					credentialId: table.passkey.credentialId
				})
				.from(table.passkey)
				.where(eq(table.passkey.userId, user.id));

			if (passkeys.length === 0) {
				await recordLoginFailure(event);
				return json(
					{ error: PASSKEY_LOGIN_FAILURE_MESSAGE, requiresCaptcha: true },
					{ status: 400 }
				);
			}

			const options: PublicKeyCredentialRequestOptionsJSON = await generateAuthenticationOptions({
				rpID: getRpID(event.request.url),
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

		const options: PublicKeyCredentialRequestOptionsJSON = await generateAuthenticationOptions({
			rpID: getRpID(event.request.url),
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
