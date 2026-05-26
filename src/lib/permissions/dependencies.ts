import { PERMISSION_CATALOG, type PermissionKey } from './catalog';

/** Permission enfant → permission parente requise. */
export const PERMISSION_REQUIRES: Partial<Record<PermissionKey, PermissionKey>> = {
	'games.auto_check': 'games.manage',
	'games.silent_mode': 'games.manage',
	'submissions.own': 'games.manage',
	'submissions.review': 'games.manage',
	'users.assign_admin': 'users.manage',
	'config.edit': 'config.view',
	'maintenance.manage': 'config.view'
};

const DEPENDENTS_BY_PARENT = new Map<PermissionKey, PermissionKey[]>();

for (const [child, parent] of Object.entries(PERMISSION_REQUIRES) as [
	PermissionKey,
	PermissionKey
][]) {
	const list = DEPENDENTS_BY_PARENT.get(parent) ?? [];
	list.push(child);
	DEPENDENTS_BY_PARENT.set(parent, list);
}

export function getPermissionParent(key: PermissionKey): PermissionKey | undefined {
	return PERMISSION_REQUIRES[key];
}

export function getDependentPermissions(parentKey: PermissionKey): readonly PermissionKey[] {
	return DEPENDENTS_BY_PARENT.get(parentKey) ?? [];
}

export function permissionRequirementLabel(parentKey: PermissionKey): string {
	return PERMISSION_CATALOG.find((p) => p.key === parentKey)?.label ?? parentKey;
}

export function isPermissionRequirementMet(
	key: PermissionKey,
	granted: ReadonlySet<string> | Record<string, boolean>
): boolean {
	const parent = PERMISSION_REQUIRES[key];
	if (!parent) return true;
	if (granted instanceof Set) return granted.has(parent);
	return Boolean((granted as Record<string, boolean>)[parent]);
}

/** Retire les droits dont le parent n’est pas accordé. */
export function enforcePermissionDependencies(keys: Iterable<string>): PermissionKey[] {
	const set = new Set(keys);
	const out: PermissionKey[] = [];
	for (const key of set) {
		if (!PERMISSION_CATALOG.some((p) => p.key === key)) continue;
		const perm = key as PermissionKey;
		if (!isPermissionRequirementMet(perm, set)) continue;
		out.push(perm);
	}
	return out;
}

/** Applique les dépendances à un état case à cocher (décoche les enfants orphelins). */
export function applyPermissionDependenciesToChecks(
	checks: Record<string, boolean>
): Record<string, boolean> {
	const next = { ...checks };
	for (const [child, parent] of Object.entries(PERMISSION_REQUIRES) as [
		PermissionKey,
		PermissionKey
	][]) {
		if (next[child] && !next[parent]) {
			next[child] = false;
		}
	}
	return next;
}
