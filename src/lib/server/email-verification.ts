import { appLogError } from '$lib/server/app-log-bridge';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { isSmtpConfigured, resolveEmailLinkOrigin, sendMail } from '$lib/server/mail';
import { hashSessionSecret } from '$lib/server/password-hash';
import { privateEnv } from '$lib/server/private-env';
import { SITE, absoluteUrl } from '$lib/site';
import { encodeBase64url } from '@oslojs/encoding';
import { redirect } from '@sveltejs/kit';
import { desc, eq, lt } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';

const VERIFICATION_TOKEN_TTL_MS = 1000 * 60 * 60 * 24;
const RESEND_COOLDOWN_MS = 1000 * 60 * 2;

export function generateEmailUnsubscribeToken(): string {
	return encodeBase64url(randomBytes(32));
}

function generateVerificationToken(): string {
	return encodeBase64url(randomBytes(32));
}

export function isUserEmailVerified(user: Pick<table.User, 'emailVerifiedAt'>): boolean {
	return user.emailVerifiedAt instanceof Date && !Number.isNaN(user.emailVerifiedAt.getTime());
}

export function emailVerificationRequired(): boolean {
	const skip = privateEnv('EMAIL_VERIFICATION_SKIP')?.trim().toLowerCase();
	if (skip === 'true' || skip === '1') return false;
	if (process.env.NODE_ENV !== 'production' && !isSmtpConfigured()) return false;
	return true;
}

function buildVerificationEmailContent(params: {
	username: string;
	verifyUrl: string;
	unsubscribeUrl: string;
}): { subject: string; text: string; html: string } {
	const subject = `Confirmez votre adresse email — ${SITE.name}`;
	const text = [
		`Bonjour ${params.username},`,
		'',
		`Merci de vous être inscrit sur ${SITE.name}.`,
		'Pour activer votre compte, confirmez votre adresse email en ouvrant le lien ci-dessous :',
		'',
		params.verifyUrl,
		'',
		'Ce lien expire dans 24 heures.',
		'',
		'Si vous ne souhaitez plus recevoir nos emails informatifs, vous pouvez vous désinscrire :',
		params.unsubscribeUrl,
		'',
		'Si vous n’avez pas créé de compte, ignorez ce message.'
	].join('\n');

	const html = `<!DOCTYPE html>
<html lang="fr">
<body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1a1a1a;max-width:36rem;margin:0 auto;padding:1.5rem;">
  <p>Bonjour <strong>${escapeHtml(params.username)}</strong>,</p>
  <p>Merci de vous être inscrit sur <strong>${escapeHtml(SITE.name)}</strong>.</p>
  <p>Pour activer votre compte, confirmez votre adresse email :</p>
  <p style="margin:1.5rem 0;">
    <a href="${escapeHtml(params.verifyUrl)}" style="display:inline-block;background:#570df8;color:#fff;text-decoration:none;padding:0.75rem 1.25rem;border-radius:0.5rem;font-weight:600;">
      Confirmer mon email
    </a>
  </p>
  <p style="font-size:0.875rem;color:#555;">Ce lien expire dans 24 heures.</p>
  <p style="font-size:0.875rem;color:#555;">
    Lien direct : <a href="${escapeHtml(params.verifyUrl)}">${escapeHtml(params.verifyUrl)}</a>
  </p>
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:1.5rem 0;" />
  <p style="font-size:0.8125rem;color:#777;">
    Vous ne souhaitez plus recevoir nos emails informatifs ?
    <a href="${escapeHtml(params.unsubscribeUrl)}">Se désinscrire</a>
  </p>
  <p style="font-size:0.8125rem;color:#777;">Si vous n’avez pas créé de compte, ignorez ce message.</p>
</body>
</html>`;

	return { subject, text, html };
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

async function deleteVerificationTokensForUser(userId: string): Promise<void> {
	await db.delete(table.emailVerificationToken).where(eq(table.emailVerificationToken.userId, userId));
}

export async function createVerificationToken(userId: string): Promise<string> {
	const rawToken = generateVerificationToken();
	const tokenHash = hashSessionSecret(rawToken);
	const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);

	await deleteVerificationTokensForUser(userId);
	await db.insert(table.emailVerificationToken).values({
		userId,
		tokenHash,
		expiresAt,
		createdAt: new Date()
	});

	return rawToken;
}

export async function sendVerificationEmailForUser(
	userId: string,
	options?: { requestOrigin?: string | null }
): Promise<
	| { ok: true }
	| { ok: false; reason: 'user_not_found' | 'already_verified' | 'smtp_not_configured' | 'cooldown' | 'send_failed' }
> {
	if (!emailVerificationRequired()) {
		await db
			.update(table.user)
			.set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
			.where(eq(table.user.id, userId));
		return { ok: true };
	}

	if (!isSmtpConfigured()) {
		return { ok: false, reason: 'smtp_not_configured' };
	}

	const [user] = await db
		.select({
			id: table.user.id,
			email: table.user.email,
			username: table.user.username,
			emailVerifiedAt: table.user.emailVerifiedAt,
			emailUnsubscribeToken: table.user.emailUnsubscribeToken,
			emailMarketingOptOut: table.user.emailMarketingOptOut
		})
		.from(table.user)
		.where(eq(table.user.id, userId))
		.limit(1);

	if (!user) return { ok: false, reason: 'user_not_found' };
	if (isUserEmailVerified(user)) return { ok: false, reason: 'already_verified' };

	const [recentToken] = await db
		.select({ createdAt: table.emailVerificationToken.createdAt })
		.from(table.emailVerificationToken)
		.where(eq(table.emailVerificationToken.userId, userId))
		.orderBy(desc(table.emailVerificationToken.createdAt))
		.limit(1);

	if (recentToken && Date.now() - recentToken.createdAt.getTime() < RESEND_COOLDOWN_MS) {
		return { ok: false, reason: 'cooldown' };
	}

	const rawToken = await createVerificationToken(userId);
	const origin = resolveEmailLinkOrigin(options?.requestOrigin);
	const verifyUrl = absoluteUrl(`/email/verify?token=${encodeURIComponent(rawToken)}`, origin);
	const unsubscribeUrl = absoluteUrl(
		`/email/unsubscribe?token=${encodeURIComponent(user.emailUnsubscribeToken)}`,
		origin
	);

	const content = buildVerificationEmailContent({
		username: user.username,
		verifyUrl,
		unsubscribeUrl
	});

	try {
		await sendMail({
			to: user.email,
			subject: content.subject,
			text: content.text,
			html: content.html
		});
		return { ok: true };
	} catch (error) {
		appLogError('email', 'Échec envoi email de vérification', error);
		return { ok: false, reason: 'send_failed' };
	}
}

export async function verifyEmailWithToken(rawToken: string): Promise<
	| { ok: true; userId: string }
	| { ok: false; reason: 'invalid' | 'expired' }
> {
	const trimmed = rawToken.trim();
	if (!trimmed) return { ok: false, reason: 'invalid' };

	const tokenHash = hashSessionSecret(trimmed);
	const now = new Date();

	const [row] = await db
		.select({
			id: table.emailVerificationToken.id,
			userId: table.emailVerificationToken.userId,
			tokenHash: table.emailVerificationToken.tokenHash,
			expiresAt: table.emailVerificationToken.expiresAt
		})
		.from(table.emailVerificationToken)
		.where(eq(table.emailVerificationToken.tokenHash, tokenHash))
		.limit(1);

	if (!row || row.tokenHash !== tokenHash) {
		return { ok: false, reason: 'invalid' };
	}

	if (row.expiresAt.getTime() <= now.getTime()) {
		await db.delete(table.emailVerificationToken).where(eq(table.emailVerificationToken.id, row.id));
		return { ok: false, reason: 'expired' };
	}

	await db
		.update(table.user)
		.set({ emailVerifiedAt: now, updatedAt: now })
		.where(eq(table.user.id, row.userId));

	await deleteVerificationTokensForUser(row.userId);

	return { ok: true, userId: row.userId };
}

export async function unsubscribeFromMarketingEmails(unsubscribeToken: string): Promise<
	| { ok: true; username: string }
	| { ok: false; reason: 'invalid' }
> {
	const trimmed = unsubscribeToken.trim();
	if (!trimmed) return { ok: false, reason: 'invalid' };

	const [user] = await db
		.select({ id: table.user.id, username: table.user.username })
		.from(table.user)
		.where(eq(table.user.emailUnsubscribeToken, trimmed))
		.limit(1);

	if (!user) return { ok: false, reason: 'invalid' };

	await db
		.update(table.user)
		.set({ emailMarketingOptOut: true, updatedAt: new Date() })
		.where(eq(table.user.id, user.id));

	return { ok: true, username: user.username };
}

/** Nettoie les jetons expirés (best effort). */
export async function purgeExpiredVerificationTokens(): Promise<void> {
	await db
		.delete(table.emailVerificationToken)
		.where(lt(table.emailVerificationToken.expiresAt, new Date()));
}

export function dashboardVerifyEmailPath(): string {
	return '/dashboard/verify-email';
}

export function isEmailVerificationExemptDashboardPath(pathname: string): boolean {
	return pathname === dashboardVerifyEmailPath() || pathname === '/dashboard/logout';
}

export function ensureEmailVerifiedOrRedirect(user: table.User, pathname: string): void {
	if (!emailVerificationRequired()) return;
	if (isUserEmailVerified(user)) return;
	if (isEmailVerificationExemptDashboardPath(pathname)) return;
	redirect(303, dashboardVerifyEmailPath());
}
