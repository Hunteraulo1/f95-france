// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			user: import('$lib/server/db/schema').User | null;
			session: import('$lib/server/db/schema').Session | null;
			/** Présent si `user` provient d’une clé API (pas de cookie de session). */
			authenticatedViaApiKey?: boolean;
		}
	} // interface Error {}
	// interface Locals {}
} // interface PageData {}
// interface PageState {}

// interface Platform {}
export { };
