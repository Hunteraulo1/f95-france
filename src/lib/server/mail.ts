import { privateEnv } from '$lib/server/private-env';
import { SITE, siteOrigin } from '$lib/site';
import nodemailer, { type Transporter } from 'nodemailer';

let transporter: Transporter | null = null;
let transporterCacheKey: string | null = null;

function parseSmtpPort(raw: string | undefined): number {
	const port = Number.parseInt(raw ?? '587', 10);
	if (!Number.isFinite(port) || port <= 0) return 587;
	return port;
}

/** Proton : 587 = STARTTLS (secure false), 465 = TLS implicite (secure true). */
function resolveSmtpTlsMode(
	port: number,
	secureEnv: string | undefined
): { secure: boolean; requireTLS: boolean } {
	const normalized = secureEnv?.trim().toLowerCase();

	if (port === 465) {
		return { secure: true, requireTLS: false };
	}

	if (port === 587) {
		return { secure: false, requireTLS: true };
	}

	if (normalized === 'true' || normalized === '1') {
		return { secure: true, requireTLS: false };
	}

	if (normalized === 'false' || normalized === '0') {
		return { secure: false, requireTLS: true };
	}

	return { secure: false, requireTLS: true };
}

export function isSmtpConfigured(): boolean {
	const host = privateEnv('SMTP_HOST')?.trim();
	const user = privateEnv('SMTP_USER')?.trim();
	const pass = privateEnv('SMTP_PASS')?.trim();
	return Boolean(host && user && pass);
}

function getTransporter(): Transporter {
	const host = privateEnv('SMTP_HOST')?.trim();
	const user = privateEnv('SMTP_USER')?.trim();
	const pass = privateEnv('SMTP_PASS')?.trim();

	if (!host || !user || !pass) {
		throw new Error('Configuration SMTP incomplète (SMTP_HOST, SMTP_USER, SMTP_PASS).');
	}

	const port = parseSmtpPort(privateEnv('SMTP_PORT'));
	const tls = resolveSmtpTlsMode(port, privateEnv('SMTP_SECURE'));
	const cacheKey = `${host}:${port}:${tls.secure}:${tls.requireTLS}:${user}`;

	if (transporter && transporterCacheKey === cacheKey) {
		return transporter;
	}

	transporter = nodemailer.createTransport({
		host,
		port,
		secure: tls.secure,
		requireTLS: tls.requireTLS,
		auth: { user, pass },
		tls: {
			minVersion: 'TLSv1.2'
		}
	});
	transporterCacheKey = cacheKey;

	return transporter;
}

export function getMailFromAddress(): string {
	const from = privateEnv('SMTP_FROM')?.trim();
	if (from) return from;
	const user = privateEnv('SMTP_USER')?.trim();
	if (user) return `${SITE.name} <${user}>`;
	return `${SITE.name} <noreply@f95france.site>`;
}

export type SendMailInput = {
	to: string;
	subject: string;
	text: string;
	html: string;
};

export async function sendMail(input: SendMailInput): Promise<void> {
	const transport = getTransporter();
	await transport.sendMail({
		from: getMailFromAddress(),
		to: input.to,
		subject: input.subject,
		text: input.text,
		html: input.html
	});
}

/** Vérifie la connexion SMTP sans envoyer d’email. */
export async function verifySmtpConnection(): Promise<void> {
	if (!isSmtpConfigured()) {
		throw new Error('Configuration SMTP incomplète (SMTP_HOST, SMTP_USER, SMTP_PASS).');
	}
	await getTransporter().verify();
}

export function getPublicAppOrigin(): string {
	return siteOrigin(privateEnv('PUBLIC_APP_ORIGIN') ?? privateEnv('APP_ORIGIN'));
}

/** En dev, préfère l’origine de la requête pour ne pas générer des liens vers la prod. */
export function resolveEmailLinkOrigin(requestOrigin?: string | null): string {
	if (process.env.NODE_ENV === 'production') {
		return getPublicAppOrigin();
	}
	const fromRequest = requestOrigin?.trim();
	if (fromRequest) {
		try {
			return new URL(fromRequest).origin;
		} catch {
			/* ignore */
		}
	}
	return getPublicAppOrigin();
}
