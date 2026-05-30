/** Priorités par défaut des rôles système (plus haut = affiché en premier). */
export const SYSTEM_ROLE_PRIORITIES: Record<string, number> = {
	user: 0,
	translator: 40,
	admin: 80,
	superadmin: 100
};

export const ROLE_PRIORITY_MIN = 0;
export const ROLE_PRIORITY_MAX = 1000;

export function resolveRolePriority(slug: string, stored: number | null | undefined): number {
	if (typeof stored === 'number' && Number.isFinite(stored)) {
		return Math.min(ROLE_PRIORITY_MAX, Math.max(ROLE_PRIORITY_MIN, Math.trunc(stored)));
	}
	return SYSTEM_ROLE_PRIORITIES[slug] ?? 0;
}

export function parseRolePriorityInput(value: FormDataEntryValue | null): number | null {
	if (value === null || value === undefined || value === '') return null;
	const parsed = Number.parseInt(String(value).trim(), 10);
	if (!Number.isFinite(parsed) || parsed < ROLE_PRIORITY_MIN || parsed > ROLE_PRIORITY_MAX) {
		return null;
	}
	return parsed;
}
