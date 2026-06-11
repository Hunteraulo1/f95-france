/** Nombre maximal de clés API actives par défaut (rôle « user », nouveaux rôles). */
export const USER_API_KEY_MAX_COUNT_DEFAULT = 3;

/** Valeurs par défaut des rôles système si non définies en base. */
export const SYSTEM_ROLE_MAX_API_KEYS: Record<string, number> = {
	user: 3,
	translator: 3,
	admin: 10,
	superadmin: 50
};

export const ROLE_API_KEYS_MIN = 0;
export const ROLE_API_KEYS_MAX = 100;

export function resolveRoleMaxApiKeys(slug: string, stored: number | null | undefined): number {
	if (typeof stored === 'number' && Number.isFinite(stored)) {
		return Math.min(ROLE_API_KEYS_MAX, Math.max(ROLE_API_KEYS_MIN, Math.trunc(stored)));
	}
	return SYSTEM_ROLE_MAX_API_KEYS[slug] ?? USER_API_KEY_MAX_COUNT_DEFAULT;
}

export function parseRoleMaxApiKeysInput(value: FormDataEntryValue | null): number | null {
	if (value === null || value === undefined || value === '') return null;
	const parsed = Number.parseInt(String(value).trim(), 10);
	if (!Number.isFinite(parsed) || parsed < ROLE_API_KEYS_MIN || parsed > ROLE_API_KEYS_MAX) {
		return null;
	}
	return parsed;
}
