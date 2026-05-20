import { get } from 'svelte/store';
import type { PermissionKey } from './permissions/catalog';
import { checkPermission } from './permissions/client';
import type { User } from './server/db/schema';
import { user } from './stores';

export type checkRoleType = User['role'] | 'all';

/** Mapping historique rôle → permission pour la navigation. */
const NAV_ROLE_PERMISSION: Partial<Record<Exclude<checkRoleType, 'all'>, PermissionKey>> = {
	translator: 'games.manage',
	admin: 'users.manage',
	superadmin: 'roles.manage'
};

const checkRole = (roles: checkRoleType[]) => {
	const loggedUser = get(user);

	if (!loggedUser) throw new Error('User is required');

	if (!loggedUser.role) throw new Error('Role is required');
	if (roles.includes('all')) return true;

	for (const role of roles) {
		if (role === 'all') continue;
		if (loggedUser.role === role) return true;
		const permission = NAV_ROLE_PERMISSION[role];
		if (permission && checkPermission(permission)) return true;
	}

	return false;
};

export { checkRole };
