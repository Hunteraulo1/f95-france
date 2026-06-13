import { env } from '$env/dynamic/private';
import { env as publicEnvKit } from '$env/dynamic/public';

type EnvRecord = Record<string, string | undefined>;

function readEnvRecord(record: EnvRecord, name: string): string | undefined {
	const kitVal = record[name];
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

/** Lit une variable `PUBLIC_*` (SvelteKit : module public, puis process.env). */
export function publicEnv(name: string): string | undefined {
	return readEnvRecord(publicEnvKit as EnvRecord, name);
}

/**
 * Lit une variable d’environnement privée au runtime.
 * SvelteKit alimente `env` sur le serveur ; `process.env` sert de repli (scripts CLI, tests).
 * Pour les clés `PUBLIC_*`, préfère {@link publicEnv} (module public SvelteKit).
 */
export function privateEnv(name: string): string | undefined {
	if (name.startsWith('PUBLIC_')) {
		return publicEnv(name) ?? readEnvRecord(env as EnvRecord, name);
	}
	return readEnvRecord(env as EnvRecord, name);
}
