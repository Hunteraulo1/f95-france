import type { PermissionKey } from '$lib/permissions/catalog';
import { hasEffectivePermission } from '$lib/permissions/effective';

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
	const bio = hasEffectivePermission(roleSlug, permissions, PROFILE_CUSTOMIZE_PERMISSIONS.bio);
	const background = hasEffectivePermission(
		roleSlug,
		permissions,
		PROFILE_CUSTOMIZE_PERMISSIONS.background
	);
	const music = hasEffectivePermission(roleSlug, permissions, PROFILE_CUSTOMIZE_PERMISSIONS.music);
	const cursor = hasEffectivePermission(
		roleSlug,
		permissions,
		PROFILE_CUSTOMIZE_PERMISSIONS.cursor
	);
	return {
		bio,
		background,
		music,
		cursor,
		any: bio || background || music || cursor
	};
}
