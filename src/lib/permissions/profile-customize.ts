import type { PermissionKey } from '$lib/permissions/catalog';
import { permissionGranted } from '$lib/permissions/check';

export const PROFILE_CUSTOMIZE_PERMISSIONS = {
	bio: 'profile.customize.bio',
	background: 'profile.customize.background',
	music: 'profile.customize.music',
	cursor: 'profile.customize.cursor'
} as const satisfies Record<string, PermissionKey>;

export type ProfileCustomizeFlags = {
	bio: boolean;
	background: boolean;
	music: boolean;
	cursor: boolean;
	any: boolean;
};

export function resolveProfileCustomizeFlags(
	roleSlug: string,
	permissions: readonly string[] | undefined
): ProfileCustomizeFlags {
	const bio = permissionGranted(roleSlug, permissions, PROFILE_CUSTOMIZE_PERMISSIONS.bio);
	const background = permissionGranted(
		roleSlug,
		permissions,
		PROFILE_CUSTOMIZE_PERMISSIONS.background
	);
	const music = permissionGranted(roleSlug, permissions, PROFILE_CUSTOMIZE_PERMISSIONS.music);
	const cursor = permissionGranted(roleSlug, permissions, PROFILE_CUSTOMIZE_PERMISSIONS.cursor);
	return {
		bio,
		background,
		music,
		cursor,
		any: bio || background || music || cursor
	};
}
