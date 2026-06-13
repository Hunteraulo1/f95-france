import * as auth from '$lib/server/auth';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import {
	getDiscordAvatarUrl,
	getDiscordGuildMemberRoles,
	type DiscordIdentity
} from '$lib/server/discord-oauth';
import type { DiscordOAuthContext } from '$lib/server/discord-oauth-state';
import {
	clearDiscordSignupPendingCookie,
	setDiscordSignupPendingCookie,
	type DiscordSignupPending
} from '$lib/server/discord-signup-pending';
import { sendVerificationEmailForUser } from '$lib/server/email-verification';
import {
	REGISTRATION_INVITE_INVALID_MESSAGE,
	isRegistrationEnabled,
	verifyRegistrationInvite
} from '$lib/server/registration-policy';
import { encodeBase64url } from '@oslojs/encoding';
import { redirect, type RequestEvent } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';

const DISCORD_ID_PATTERN = /^\d{17,20}$/;

export function parseDiscordId(identity: DiscordIdentity): string | null {
	const discordId = identity.id?.trim();
	if (!discordId || !DISCORD_ID_PATTERN.test(discordId)) {
		return null;
	}
	return discordId;
}

function sanitizeUsernameBase(raw: string): string {
	const normalized = raw
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_|_$/g, '');

	return normalized.slice(0, 32);
}

export function suggestUsernameFromDiscord(identity: DiscordIdentity): string {
	const preferred = sanitizeUsernameBase(identity.global_name ?? identity.username ?? 'user');
	let base = preferred.length >= 3 ? preferred : `user_${preferred}`.slice(0, 32);
	if (base.length < 3) {
		base = `user_${encodeBase64url(randomBytes(4))
			.replace(/[^a-z0-9]/gi, '')
			.slice(0, 8)}`;
	}
	return base;
}

export function validateDiscordSignupUsername(username: string): string | null {
	const trimmed = username.trim();
	if (trimmed.length < 3) {
		return "Le nom d'utilisateur doit contenir au moins 3 caractères.";
	}
	if (trimmed.length > 32) {
		return "Le nom d'utilisateur ne peut pas dépasser 32 caractères.";
	}
	if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
		return 'Utilisez uniquement des lettres, chiffres, tirets et underscores.';
	}
	return null;
}

function resolveDiscordEmail(identity: DiscordIdentity): string | null {
	const email = identity.email?.trim().toLowerCase();
	if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		return null;
	}
	return email;
}

function discordLabelFromIdentity(identity: DiscordIdentity): string {
	return (identity.global_name ?? identity.username ?? 'Discord').trim() || 'Discord';
}

async function applyDiscordAccountExtras(params: {
	userId: string;
	discordId: string;
	accessToken: string;
	currentAvatar?: string | null;
	currentRole?: string | null;
	isStaffAccount: boolean;
	autoRoleSync: boolean;
	guildId: string;
	translatorRoleId: string;
}) {
	const [matchingTranslator] = await db
		.select({ id: table.translator.id, userId: table.translator.userId })
		.from(table.translator)
		.where(eq(table.translator.discordId, params.discordId))
		.limit(1);

	if (
		matchingTranslator &&
		(!matchingTranslator.userId || matchingTranslator.userId === params.userId)
	) {
		await db
			.update(table.translator)
			.set({ userId: params.userId })
			.where(eq(table.translator.id, matchingTranslator.id));
	}

	if ((params.currentAvatar ?? '').trim() === '') {
		const avatarUrl = await getDiscordAvatarUrl(params.discordId);
		if (avatarUrl) {
			await db
				.update(table.user)
				.set({ avatar: avatarUrl })
				.where(eq(table.user.id, params.userId));
		}
	}

	if (params.autoRoleSync && params.guildId && params.translatorRoleId) {
		const roleIds = await getDiscordGuildMemberRoles({
			accessToken: params.accessToken,
			guildId: params.guildId
		});
		if (roleIds) {
			const hasTranslatorRole = roleIds.includes(params.translatorRoleId);
			const currentRole = params.currentRole ?? 'user';

			if (!params.isStaffAccount && hasTranslatorRole && currentRole === 'user') {
				await db
					.update(table.user)
					.set({ role: 'translator' })
					.where(eq(table.user.id, params.userId));
			}
			if (!params.isStaffAccount && !hasTranslatorRole && currentRole === 'translator') {
				await db.update(table.user).set({ role: 'user' }).where(eq(table.user.id, params.userId));
			}
		}
	}
}

export async function linkDiscordToUser(params: {
	userId: string;
	discordId: string;
	accessToken: string;
	isStaffAccount: boolean;
	autoRoleSync: boolean;
	guildId: string;
	translatorRoleId: string;
}) {
	const [ownerConflict] = await db
		.select({ id: table.user.id })
		.from(table.user)
		.where(eq(table.user.discordId, params.discordId))
		.limit(1);

	if (ownerConflict && ownerConflict.id !== params.userId) {
		throw new Error('discord_already_linked');
	}

	const [currentUser] = await db
		.select({ avatar: table.user.avatar, role: table.user.role })
		.from(table.user)
		.where(eq(table.user.id, params.userId))
		.limit(1);

	await db
		.update(table.user)
		.set({ discordId: params.discordId })
		.where(eq(table.user.id, params.userId));

	await applyDiscordAccountExtras({
		userId: params.userId,
		discordId: params.discordId,
		accessToken: params.accessToken,
		currentAvatar: currentUser?.avatar,
		currentRole: currentUser?.role,
		isStaffAccount: params.isStaffAccount,
		autoRoleSync: params.autoRoleSync,
		guildId: params.guildId,
		translatorRoleId: params.translatorRoleId
	});
}

async function registerUserFromDiscordWithUsername(params: {
	username: string;
	email: string;
	discordId: string;
	emailVerified: boolean;
	accessToken: string;
	requestOrigin: string;
	autoRoleSync: boolean;
	guildId: string;
	translatorRoleId: string;
}) {
	const avatarUrl = await getDiscordAvatarUrl(params.discordId);
	const emailVerifiedAt = params.emailVerified ? new Date() : null;

	const user = await auth.createUserFromDiscord({
		username: params.username,
		email: params.email,
		discordId: params.discordId,
		avatar: avatarUrl ?? '',
		emailVerifiedAt
	});

	if (!emailVerifiedAt) {
		try {
			await sendVerificationEmailForUser(user.id, { requestOrigin: params.requestOrigin });
		} catch (emailError) {
			console.error('Erreur envoi email vérification (Discord):', emailError);
		}
	}

	try {
		const { notifyNewUserRegistration } = await import('$lib/server/notifications');
		await notifyNewUserRegistration(user.id, params.username);
	} catch (notificationError) {
		console.error('Erreur notification inscription Discord:', notificationError);
	}

	await applyDiscordAccountExtras({
		userId: user.id,
		discordId: params.discordId,
		accessToken: params.accessToken,
		currentAvatar: user.avatar,
		currentRole: user.role,
		isStaffAccount: false,
		autoRoleSync: params.autoRoleSync,
		guildId: params.guildId,
		translatorRoleId: params.translatorRoleId
	});

	return user;
}

function redirectToDiscordSignup(params: {
	event: RequestEvent;
	context: DiscordOAuthContext;
	identity: DiscordIdentity;
	discordId: string;
	accessToken: string;
	email: string;
}): never {
	setDiscordSignupPendingCookie(params.event, {
		discordId: params.discordId,
		email: params.email,
		emailVerified: params.identity.verified === true,
		accessToken: params.accessToken,
		redirectTo: params.context.redirectTo,
		inviteCode: params.context.inviteCode,
		discordLabel: discordLabelFromIdentity(params.identity),
		suggestedUsername: suggestUsernameFromDiscord(params.identity)
	});
	redirect(302, '/dashboard/account/register/discord');
}

export async function finalizeDiscordSignup(params: {
	event: RequestEvent;
	pending: DiscordSignupPending;
	username: string;
	inviteCode?: string;
	autoRoleSync: boolean;
	guildId: string;
	translatorRoleId: string;
}): Promise<string> {
	if (!isRegistrationEnabled()) {
		throw new Error('registration_disabled');
	}

	const invite = (params.inviteCode ?? params.pending.inviteCode)?.trim();
	if (!verifyRegistrationInvite(invite)) {
		throw new Error(invite ? 'invite_invalid' : 'invite_required');
	}

	const usernameError = validateDiscordSignupUsername(params.username);
	if (usernameError) {
		throw new Error(`username_invalid:${usernameError}`);
	}

	const username = params.username.trim();

	if (await auth.getUserByDiscordId(params.pending.discordId)) {
		throw new Error('account_exists');
	}
	if (await auth.getUserByEmail(params.pending.email)) {
		throw new Error('account_exists');
	}
	if (await auth.getUserByUsername(username)) {
		throw new Error('username_taken');
	}

	const user = await registerUserFromDiscordWithUsername({
		username,
		email: params.pending.email,
		discordId: params.pending.discordId,
		emailVerified: params.pending.emailVerified,
		accessToken: params.pending.accessToken,
		requestOrigin: params.event.url.origin,
		autoRoleSync: params.autoRoleSync,
		guildId: params.guildId,
		translatorRoleId: params.translatorRoleId
	});

	clearDiscordSignupPendingCookie(params.event);

	return auth.signInUserAndGetDestination(params.event, user, params.pending.redirectTo);
}

export async function completeDiscordLogin(params: {
	event: RequestEvent;
	context: DiscordOAuthContext;
	identity: DiscordIdentity;
	discordId: string;
	accessToken: string;
	autoRoleSync: boolean;
	guildId: string;
	translatorRoleId: string;
}): Promise<string> {
	const user = await auth.getUserByDiscordId(params.discordId);

	if (!user) {
		if (!isRegistrationEnabled()) {
			throw new Error('registration_disabled');
		}

		const email = resolveDiscordEmail(params.identity);
		if (!email) {
			throw new Error('email_required');
		}

		if (await auth.getUserByEmail(email)) {
			throw new Error('account_exists');
		}

		redirectToDiscordSignup({
			event: params.event,
			context: params.context,
			identity: params.identity,
			discordId: params.discordId,
			accessToken: params.accessToken,
			email
		});
	}

	await applyDiscordAccountExtras({
		userId: user.id,
		discordId: params.discordId,
		accessToken: params.accessToken,
		currentAvatar: user.avatar,
		currentRole: user.role,
		isStaffAccount: false,
		autoRoleSync: params.autoRoleSync,
		guildId: params.guildId,
		translatorRoleId: params.translatorRoleId
	});

	return auth.signInUserAndGetDestination(params.event, user, params.context.redirectTo);
}

export { REGISTRATION_INVITE_INVALID_MESSAGE };
