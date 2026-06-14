import { isPublicDashboardPath } from '$lib/server/dashboard-auth';
import { getDevImpersonationOriginUser } from '$lib/server/dev-impersonation';
import {
	emailVerificationRequired,
	ensureEmailVerifiedOrRedirect,
	isUserEmailVerified
} from '$lib/server/email-verification';
import { userHasLinkedTranslator } from '$lib/server/linked-translator';
import { getMaintenanceMode } from '$lib/server/maintenance-mode';
import { getPendingSubmissionsCountForUser } from '$lib/server/pending-submissions-count';
import { hasPermission } from '$lib/server/permissions';
import { isRegistrationEnabled } from '$lib/server/registration-policy';
import { listRoleBadgeStylesMap } from '$lib/server/role-badge-styles';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, cookies, url, depends }) => {
	depends('app:dashboard-layout');

	if (!locals.user) {
		const pathname = url.pathname;
		if (!isPublicDashboardPath(pathname)) {
			const redirectTo = encodeURIComponent(pathname + url.search);
			redirect(303, `/dashboard/account/login?redirectTo=${redirectTo}`);
		}
	} else if (emailVerificationRequired() && !isUserEmailVerified(locals.user)) {
		ensureEmailVerifiedOrRedirect(locals.user, url.pathname);
	}

	const permissions = locals.user ? (locals.permissions ?? []) : [];
	const canManageConfig = locals.user ? hasPermission(locals, 'config.view') : false;
	const skipLinkedTranslatorQuery = locals.user ? hasPermission(locals, 'roles.manage') : false;

	const [
		pendingSubmissionsCount,
		maintenanceMode,
		hasLinkedTranslator,
		devOriginUser,
		roleBadgeStyles
	] = await Promise.all([
		locals.user ? getPendingSubmissionsCountForUser(locals) : Promise.resolve(0),
		getMaintenanceMode(),
		locals.user
			? skipLinkedTranslatorQuery
				? Promise.resolve(true)
				: userHasLinkedTranslator(locals.user.id)
			: Promise.resolve(false),
		locals.user ? getDevImpersonationOriginUser(cookies) : Promise.resolve(null),
		listRoleBadgeStylesMap()
	]);

	return {
		user: locals.user,
		permissions,
		roleBadgeStyles,
		pendingSubmissionsCount,
		hasLinkedTranslator,
		maintenanceMode,
		canManageConfig,
		canReturnToOwnAccount: Boolean(devOriginUser),
		devOriginUsername: devOriginUser?.username ?? null,
		registrationEnabled: isRegistrationEnabled()
	};
};
