import { listRoleBadgeStylesMap } from '$lib/server/role-badge-styles';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	const roleBadgeStyles = await listRoleBadgeStylesMap();
	return { roleBadgeStyles };
};
