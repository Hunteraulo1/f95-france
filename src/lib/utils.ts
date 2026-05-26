import { get } from 'svelte/store';
import type { PermissionKey } from './permissions/catalog';
import { getHasPermission } from './permissions/client';
import type { User } from './server/db/schema';
import { user } from './stores';

export type checkRoleType = User['role'] | 'all';

/** Alias historiques de rôles → permission requise (plus de contrôle par slug de rôle). */
const ROLE_ACCESS_PERMISSION: Partial<Record<Exclude<checkRoleType, 'all'>, PermissionKey>> = {
	translator: 'games.manage',
	admin: 'users.manage',
	superadmin: 'roles.manage',
	user: 'dashboard.view'
};

const checkRole = (roles: checkRoleType[]) => {
	const loggedUser = get(user);

	if (!loggedUser) throw new Error('User is required');

	if (!loggedUser.role) throw new Error('Role is required');
	if (roles.includes('all')) return true;

	for (const role of roles) {
		if (role === 'all') continue;
		const permission = ROLE_ACCESS_PERMISSION[role];
		if (permission && getHasPermission()(permission)) return true;
	}

	return false;
};

export { checkRole };
