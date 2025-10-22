import { writable } from 'svelte/store';
import type { User } from './server/db/schema';

const user = writable<User | null>({
  id: 'leaizfhzeli',
  email: 'email@user.com',
  username: 'Hunteraulo',
  avatar: 'https://cdn.discordapp.com/avatars/1234567890123456789/1234567890123456789.png?size=1024',
  passwordHash: '',
  role: 'superadmin',
  theme: 'dark',
  devUserId: '',
  gameAdd: 0,
  gameEdit: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
});

// Fonction pour charger les données utilisateur depuis le serveur
export const loadUserData = async (userId: string) => {
	try {
		const response = await fetch(`/api/user/${userId}`);
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

// Fonction pour réinitialiser le store
export const clearUserData = () => {
	user.set(null);
};

export { user };
