import { error } from '@sveltejs/kit';
import { hasPermission, userHasPermission } from './permissions';

export async function assertPermission(
	locals: App.Locals,
	key: string,
	message = 'Accès non autorisé'
): Promise<void> {
	if (locals.permissions && hasPermission(locals.permissions, key)) {
		return;
	}
	if (locals.user && (await userHasPermission(locals.user, key))) {
		return;
	}
	error(403, message);
}

export async function assertAnyPermission(
	locals: App.Locals,
	keys: string[],
	message = 'Accès non autorisé'
): Promise<void> {
	for (const key of keys) {
		if (locals.permissions && hasPermission(locals.permissions, key)) {
			return;
		}
		if (locals.user && (await userHasPermission(locals.user, key))) {
			return;
		}
	}
	error(403, message);
}
