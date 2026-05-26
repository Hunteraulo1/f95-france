import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { countEffectivePermissionsForRole, hasPermissionForUser } from '$lib/server/permissions';
import type { Cookies } from '@sveltejs/kit';
import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';

/** Cookie httpOnly posé lors d’un « Changer d’utilisateur (Dev) » (compte d’origine → autre compte). */
export const DEV_IMPERSONATION_ORIGIN_COOKIE = 'dev-impersonation-origin-user-id';

/** Rôles vers lesquels l’impersonation dev n’est pas autorisée. */
export const DEV_IMPERSONATION_FORBIDDEN_TARGET_ROLES = ['superadmin'] as const;

const forbiddenTargetRoles = new Set<string>(DEV_IMPERSONATION_FORBIDDEN_TARGET_ROLES);

export function isDevImpersonationTargetAllowed(role: string): boolean {
	return !forbiddenTargetRoles.has(role);
}

export type DevImpersonationTargetUser = {
	id: string;
	username: string;
	role: string;
};

export type DevImpersonationCheckResult = { allowed: true } | { allowed: false; message: string };

/** Vérifie qu’un compte dev peut impersonner la cible (rôle interdit + total des droits). */
export async function assertDevImpersonationTargetAllowed(
	actorRole: string,
	targetRole: string
): Promise<DevImpersonationCheckResult> {
	if (!isDevImpersonationTargetAllowed(targetRole)) {
		return {
			allowed: false,
			message: 'Impossible de basculer vers un super administrateur'
		};
	}

	const [actorCount, targetCount] = await Promise.all([
		countEffectivePermissionsForRole(actorRole),
		countEffectivePermissionsForRole(targetRole)
	]);

	if (targetCount > actorCount) {
		return {
			allowed: false,
			message: `Cet utilisateur a plus de droits que vous (${targetCount} contre ${actorCount}) — bascule refusée`
		};
	}

	return { allowed: true };
}

/** Utilisateurs éligibles à l’impersonation pour un compte donné (même règles que `assertDevImpersonationTargetAllowed`). */
export async function filterUsersForDevImpersonation(
	actorRole: string,
	candidates: DevImpersonationTargetUser[]
): Promise<DevImpersonationTargetUser[]> {
	if (candidates.length === 0) return [];

	const actorCount = await countEffectivePermissionsForRole(actorRole);

	const eligible: DevImpersonationTargetUser[] = [];
	for (const user of candidates) {
		if (!isDevImpersonationTargetAllowed(user.role)) continue;
		const targetCount = await countEffectivePermissionsForRole(user.role);
		if (targetCount <= actorCount) {
			eligible.push(user);
		}
	}
	return eligible;
}

/** Compte dont les droits effectifs plafonnent l’impersonation (session courante uniquement). */
export async function getDevImpersonationActorUser(
	currentUser: { id: string; role: string } | null | undefined
): Promise<{ id: string; username: string; role: string } | null> {
	if (!currentUser) return null;
	const [user] = await db
		.select({
			id: table.user.id,
			username: table.user.username,
			role: table.user.role
		})
		.from(table.user)
		.where(eq(table.user.id, currentUser.id))
		.limit(1);
	return user ?? null;
}

export async function getDevImpersonationOriginUser(cookies: Cookies) {
	const devOriginUserId = cookies.get(DEV_IMPERSONATION_ORIGIN_COOKIE);
	if (!devOriginUserId) return null;

	const [devOriginUser] = await db
		.select({ id: table.user.id, username: table.user.username, role: table.user.role })
		.from(table.user)
		.where(eq(table.user.id, devOriginUserId))
		.limit(1);

	if (!devOriginUser || !(await hasPermissionForUser(devOriginUser, 'dev.impersonate'))) {
		return null;
	}

	return devOriginUser;
}

export async function returnToOwnAccount(sessionId: string, cookies: Cookies) {
	const originUser = await getDevImpersonationOriginUser(cookies);
	if (!originUser) {
		return fail(400, { message: "Aucun compte d'origine à restaurer" });
	}

	try {
		await db
			.update(table.session)
			.set({ userId: originUser.id })
			.where(eq(table.session.id, sessionId));
		cookies.delete(DEV_IMPERSONATION_ORIGIN_COOKIE, { path: '/' });
		return { success: true, message: `Retour sur ${originUser.username}` };
	} catch (error: unknown) {
		console.error("Erreur lors du retour au compte d'origine:", error);
		return fail(500, { message: "Erreur lors du retour au compte d'origine" });
	}
}
