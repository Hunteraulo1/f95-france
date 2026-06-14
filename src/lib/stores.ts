import { writable } from 'svelte/store';
import type { User } from './server/db/schema';

// Store utilisateur (Svelte store classique)
export const user = writable<User | null>(null);

/** Droits effectifs du rôle courant (rempli par le layout dashboard). */
export const userPermissions = writable<string[]>([]);

/** Styles badge / pseudo par slug de rôle (rempli par le layout dashboard). */
export const roleBadgeStyles = writable<Record<string, string>>({});

// Store pour les toasts
export const toasts = writable<
	Array<{ id: string; alertType: 'info' | 'warning' | 'success' | 'error'; message: string }>
>([]);

// Fonction pour ajouter un toast
export const newToast = (toast: {
	alertType: 'info' | 'warning' | 'success' | 'error';
	message: string;
}) => {
	const id = Math.random().toString(36).slice(2, 11);
	toasts.update((current) => [...current, { id, ...toast }]);

	// Auto-remove après 5 secondes
	setTimeout(() => {
		toasts.update((current) => current.filter((t) => t.id !== id));
	}, 5000);
};

// Fonction pour mettre à jour les données utilisateur
export const updateUserData = (userData: User | null) => {
	user.set(userData);
};

// Fonction pour initialiser les données utilisateur depuis les locals
export const initializeUserFromLocals = (userData: User | null) => {
	if (userData) {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { passwordHash, twoFactorSecret, ...userWithoutPassword } = userData;
		user.set(userWithoutPassword as User);
	} else {
		user.set(null);
	}
};

// Fonction pour réinitialiser le store
export const clearUserData = () => {
	user.set(null);
	userPermissions.set([]);
	roleBadgeStyles.set({});
};

export const setUserPermissions = (permissions: string[]) => {
	userPermissions.set(permissions);
};

export const setRoleBadgeStyles = (styles: Record<string, string>) => {
	roleBadgeStyles.set(styles);
};

/** Alimente les stores session depuis le layout (SSR + navigations client). */
export const syncSessionFromLayoutData = (data: {
	user?: User | null;
	permissions?: string[];
	roleBadgeStyles?: Record<string, string>;
}): void => {
	initializeUserFromLocals(data.user ?? null);
	setUserPermissions(data.permissions ?? []);
	setRoleBadgeStyles(data.roleBadgeStyles ?? {});
};
