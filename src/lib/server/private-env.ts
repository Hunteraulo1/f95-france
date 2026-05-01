import { env } from '$env/dynamic/private';

type EnvRecord = Record<string, string | undefined>;

/**
 * Lit une variable d’environnement privée au runtime.
 * SvelteKit alimente `env` sur le serveur ; `process.env` sert de repli (scripts CLI, tests).
 */
export function privateEnv(name: string): string | undefined {
	const kitVal = (env as EnvRecord)[name];
	if (typeof kitVal === 'string') {
		const t = kitVal.trim();
		if (t !== '') return t;
	}
	const p = process.env[name];
	if (typeof p === 'string') {
		const t = p.trim();
		if (t !== '') return t;
	}
	return undefined;
}
