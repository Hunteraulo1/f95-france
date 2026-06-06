import { appLogError } from '$lib/server/app-log-bridge';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { isSmtpConfigured, resolveEmailLinkOrigin, sendMail } from '$lib/server/mail';
import { hashPassword, hashSessionSecret } from '$lib/server/password-hash';
import { SITE, absoluteUrl } from '$lib/site';
import { encodeBase64url } from '@oslojs/encoding';
import { desc, eq, lt } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';

const RESET_TOKEN_TTL_MS = 1000 * 60 * 60;
const RESEND_COOLDOWN_MS = 1000 * 60 * 2;

export const PASSWORD_RESET_GENERIC_SUCCESS_MESSAGE =
	'Si un compte existe avec cette adresse email, un lien de réinitialisation vient d’être envoyé.';

function generateResetToken(): string {
	return encodeBase64url(randomBytes(32));
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

function buildPasswordResetEmailContent(params: {
	username: string;
	resetUrl: string;
	unsubscribeUrl: string;
}): { subject: string; text: string; html: string } {
	const subject = `Réinitialisation de votre mot de passe — ${SITE.name}`;
	const text = [
		`Bonjour ${params.username},`,
		'',
		`Une demande de réinitialisation de mot de passe a été effectuée pour votre compte ${SITE.name}.`,
		'Pour choisir un nouveau mot de passe, ouvrez le lien ci-dessous :',
		'',
		params.resetUrl,
		'',
		'Ce lien expire dans 1 heure.',
		'',
		'Si vous n’êtes pas à l’origine de cette demande, ignorez cet email — votre mot de passe actuel reste inchangé.',
		'',
		'Pour vous désinscrire de nos emails informatifs (pas les emails de sécurité) :',
		params.unsubscribeUrl
	].join('\n');

	const html = `<!DOCTYPE html>
<html lang="fr">
<body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1a1a1a;max-width:36rem;margin:0 auto;padding:1.5rem;">
  <p>Bonjour <strong>${escapeHtml(params.username)}</strong>,</p>
  <p>Une demande de réinitialisation de mot de passe a été effectuée pour votre compte <strong>${escapeHtml(SITE.name)}</strong>.</p>
  <p style="margin:1.5rem 0;">
    <a href="${escapeHtml(params.resetUrl)}" style="display:inline-block;background:#570df8;color:#fff;text-decoration:none;padding:0.75rem 1.25rem;border-radius:0.5rem;font-weight:600;">
      Réinitialiser mon mot de passe
    </a>
  </p>
  <p style="font-size:0.875rem;color:#555;">Ce lien expire dans 1 heure.</p>
  <p style="font-size:0.875rem;color:#555;">
    Lien direct : <a href="${escapeHtml(params.resetUrl)}">${escapeHtml(params.resetUrl)}</a>
  </p>
  <p style="font-size:0.875rem;color:#555;">
    Si vous n’êtes pas à l’origine de cette demande, ignorez cet email — votre mot de passe actuel reste inchangé.
  </p>
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:1.5rem 0;" />
  <p style="font-size:0.8125rem;color:#777;">
    <a href="${escapeHtml(params.unsubscribeUrl)}">Se désinscrire</a> des emails informatifs
  </p>
</body>
</html>`;

	return { subject, text, html };
}

async function deleteResetTokensForUser(userId: string): Promise<void> {
	await db.delete(table.passwordResetToken).where(eq(table.passwordResetToken.userId, userId));
}

async function createResetToken(userId: string): Promise<string> {
	const rawToken = generateResetToken();
	const tokenHash = hashSessionSecret(rawToken);
	const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

	await deleteResetTokensForUser(userId);
	await db.insert(table.passwordResetToken).values({
		userId,
		tokenHash,
		expiresAt,
		createdAt: new Date()
	});

	return rawToken;
}

export async function sendPasswordResetEmailForUser(
	userId: string,
	options?: { requestOrigin?: string | null }
): Promise<{ ok: true } | { ok: false; reason: 'user_not_found' | 'cooldown' | 'send_failed' }> {
	if (!isSmtpConfigured()) {
		return { ok: false, reason: 'send_failed' };
	}

	const [user] = await db
		.select({
			id: table.user.id,
			email: table.user.email,
			username: table.user.username,
			emailUnsubscribeToken: table.user.emailUnsubscribeToken
		})
		.from(table.user)
		.where(eq(table.user.id, userId))
		.limit(1);

	if (!user) return { ok: false, reason: 'user_not_found' };

	const [recentToken] = await db
		.select({ createdAt: table.passwordResetToken.createdAt })
		.from(table.passwordResetToken)
		.where(eq(table.passwordResetToken.userId, userId))
		.orderBy(desc(table.passwordResetToken.createdAt))
		.limit(1);

	if (recentToken && Date.now() - recentToken.createdAt.getTime() < RESEND_COOLDOWN_MS) {
		return { ok: false, reason: 'cooldown' };
	}

	const rawToken = await createResetToken(userId);
	const origin = resolveEmailLinkOrigin(options?.requestOrigin);
	const resetUrl = absoluteUrl(`/email/reset-password?token=${encodeURIComponent(rawToken)}`, origin);
	const unsubscribeUrl = absoluteUrl(
		`/email/unsubscribe?token=${encodeURIComponent(user.emailUnsubscribeToken)}`,
		origin
	);

	const content = buildPasswordResetEmailContent({
		username: user.username,
		resetUrl,
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
		appLogError('email', 'Échec envoi email de réinitialisation mot de passe', error);
		return { ok: false, reason: 'send_failed' };
	}
}

/** Demande de reset par email — ne révèle pas si le compte existe. */
export async function requestPasswordResetByEmail(
	email: string,
	options?: { requestOrigin?: string | null }
): Promise<
	| { ok: true; message: string }
	| { ok: false; reason: 'invalid_email' | 'cooldown' | 'smtp_not_configured' }
> {
	const normalized = email.trim().toLowerCase();
	if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
		return { ok: false, reason: 'invalid_email' };
	}

	if (!isSmtpConfigured()) {
		return { ok: false, reason: 'smtp_not_configured' };
	}

	const [user] = await db
		.select({ id: table.user.id })
		.from(table.user)
		.where(eq(table.user.email, normalized))
		.limit(1);

	if (!user) {
		return { ok: true, message: PASSWORD_RESET_GENERIC_SUCCESS_MESSAGE };
	}

	const sent = await sendPasswordResetEmailForUser(user.id, options);
	if (!sent.ok && sent.reason === 'cooldown') {
		return { ok: false, reason: 'cooldown' };
	}

	if (!sent.ok) {
		appLogError('password-reset', 'Échec envoi reset pour utilisateur existant', {
			userId: user.id,
			reason: sent.reason
		});
	}

	return { ok: true, message: PASSWORD_RESET_GENERIC_SUCCESS_MESSAGE };
}

export async function validatePasswordResetToken(rawToken: string): Promise<
	| { ok: true; userId: string }
	| { ok: false; reason: 'invalid' | 'expired' }
> {
	const trimmed = rawToken.trim();
	if (!trimmed) return { ok: false, reason: 'invalid' };

	const tokenHash = hashSessionSecret(trimmed);
	const now = new Date();

	const [row] = await db
		.select({
			id: table.passwordResetToken.id,
			userId: table.passwordResetToken.userId,
			expiresAt: table.passwordResetToken.expiresAt
		})
		.from(table.passwordResetToken)
		.where(eq(table.passwordResetToken.tokenHash, tokenHash))
		.limit(1);

	if (!row) return { ok: false, reason: 'invalid' };

	if (row.expiresAt.getTime() <= now.getTime()) {
		await db.delete(table.passwordResetToken).where(eq(table.passwordResetToken.id, row.id));
		return { ok: false, reason: 'expired' };
	}

	return { ok: true, userId: row.userId };
}

export async function resetPasswordWithToken(
	rawToken: string,
	newPassword: string
): Promise<{ ok: true } | { ok: false; reason: 'invalid' | 'expired' | 'weak_password' }> {
	if (!newPassword || newPassword.length < 8) {
		return { ok: false, reason: 'weak_password' };
	}

	const validation = await validatePasswordResetToken(rawToken);
	if (!validation.ok) return validation;

	const tokenHash = hashSessionSecret(rawToken.trim());
	const passwordHash = await hashPassword(newPassword);
	const now = new Date();

	await db
		.update(table.user)
		.set({ passwordHash, updatedAt: now })
		.where(eq(table.user.id, validation.userId));

	await db.delete(table.session).where(eq(table.session.userId, validation.userId));
	await deleteResetTokensForUser(validation.userId);
	await db
		.delete(table.passwordResetToken)
		.where(eq(table.passwordResetToken.tokenHash, tokenHash));

	return { ok: true };
}

export async function purgeExpiredPasswordResetTokens(): Promise<void> {
	await db
		.delete(table.passwordResetToken)
		.where(lt(table.passwordResetToken.expiresAt, new Date()));
}
