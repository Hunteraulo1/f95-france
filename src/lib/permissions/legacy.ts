import {
  PERMISSION_CATALOG,
  SYSTEM_ROLE_PERMISSIONS,
  type PermissionKey
} from './catalog';

export function legacyPermissionsForRole(roleSlug: string): PermissionKey[] {
	const mapped = SYSTEM_ROLE_PERMISSIONS[roleSlug];
	if (mapped) return [...mapped];
	return [...SYSTEM_ROLE_PERMISSIONS.user];
}

export function permissionCatalogGrouped(): Map<string, typeof PERMISSION_CATALOG> {
	const groups = new Map<string, typeof PERMISSION_CATALOG>();
	for (const def of PERMISSION_CATALOG) {
		const list = groups.get(def.group) ?? [];
		list.push(def);
		groups.set(def.group, list);
	}
	return groups;
}
