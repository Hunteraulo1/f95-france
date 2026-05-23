import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { userHasPermission } from '$lib/server/permissions';
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

export async function getDevImpersonationOriginUser(cookies: Cookies) {
	const devOriginUserId = cookies.get(DEV_IMPERSONATION_ORIGIN_COOKIE);
	if (!devOriginUserId) return null;

	const [devOriginUser] = await db
		.select({ id: table.user.id, username: table.user.username, role: table.user.role })
		.from(table.user)
		.where(eq(table.user.id, devOriginUserId))
		.limit(1);

	if (!devOriginUser || !(await userHasPermission(devOriginUser, 'dev.impersonate'))) {
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
