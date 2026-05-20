/** Cookie httpOnly posé lors d’un « Changer d’utilisateur (Dev) » (compte d’origine → autre compte). */
export const DEV_IMPERSONATION_ORIGIN_COOKIE = 'dev-impersonation-origin-user-id';

/** Rôles vers lesquels l’impersonation dev n’est pas autorisée. */
export const DEV_IMPERSONATION_FORBIDDEN_TARGET_ROLES = ['superadmin'] as const;

const forbiddenTargetRoles = new Set<string>(DEV_IMPERSONATION_FORBIDDEN_TARGET_ROLES);

export function isDevImpersonationTargetAllowed(role: string): boolean {
	return !forbiddenTargetRoles.has(role);
}
