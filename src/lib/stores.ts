import { writable } from 'svelte/store';
import type { User } from './server/db/schema';

const user = writable<User | null>(null);

// Fonction pour charger les données utilisateur depuis le serveur
export const loadUserData = async () => {
	try {
		const response = await fetch(`/dashboard/user`);
		if (response.ok) {
			const userData = await response.json();
			user.set(userData);
			return userData;
		} else {
			console.error('Erreur lors du chargement des données utilisateur');
			user.set(null);
			return null;
		}
	} catch (error) {
		console.error('Erreur lors du chargement des données utilisateur:', error);
		user.set(null);
		return null;
	}
};

// Fonction pour mettre à jour les données utilisateur
export const updateUserData = (userData: User | null) => {
	user.set(userData);
};

// Fonction pour initialiser les données utilisateur depuis les locals
export const initializeUserFromLocals = (userData: User | null) => {
	console.log('🔍 Store - Initialisation avec:', userData?.username);
	if (userData) {
		// Supprimer le passwordHash des données côté client
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { passwordHash, ...userWithoutPassword } = userData;
		console.log('🔍 Store - Mise à jour du store avec:', userWithoutPassword.username);
		user.set(userWithoutPassword as User);
	} else {
		console.log('🔍 Store - Mise à jour du store avec null');
		user.set(null);
	}
};

// Fonction pour réinitialiser le store
export const clearUserData = () => {
	user.set(null);
};

// Export du store
export { user };
