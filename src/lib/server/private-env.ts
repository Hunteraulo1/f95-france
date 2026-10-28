function readEnv(name: string): string | undefined {
	const p = process.env[name];
	if (typeof p === 'string') {
		const t = p.trim();
		if (t !== '') return t;
	}
	return undefined;
}

/** Lit une variable `PUBLIC_*` depuis `process.env`. */
export function publicEnv(name: string): string | undefined {
	return readEnv(name);
}

/**
 * Lit une variable d’environnement privée au runtime depuis `process.env`.
 * SvelteKit 3 n’expose plus `$env/dynamic/*` sans déclaration dans `src/env.ts` :
 * bun (dev) et le conteneur (prod) alimentent `process.env`.
 */
export function privateEnv(name: string): string | undefined {
	return readEnv(name);
}
