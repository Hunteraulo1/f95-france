import { db } from '$lib/server/db';
import { translator } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

export function normalizePendingNewTranslatorNames(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	const seen = new Set<string>();
	const out: string[] = [];
	for (const item of raw) {
		if (typeof item !== 'string') continue;
		const trimmed = item.trim();
		if (!trimmed || seen.has(trimmed)) continue;
		seen.add(trimmed);
		out.push(trimmed);
	}
	return out;
}

/** Crée ou récupère un traducteur par nom (pages vides par défaut). */
export async function ensureTranslatorByName(name: string): Promise<string> {
	const trimmed = name.trim();
	if (!trimmed) {
		throw new Error('Nom de traducteur requis');
	}

	const [existing] = await db
		.select({ id: translator.id })
		.from(translator)
		.where(eq(translator.name, trimmed))
		.limit(1);

	if (existing) return existing.id;

	const id = randomUUID();
	await db.insert(translator).values({ id, name: trimmed, pages: '[]' });

	return id;
}

/** Crée les traducteurs proposés dans une soumission ; retourne nom → id. */
export async function createPendingTranslators(names: string[]): Promise<Map<string, string>> {
	const map = new Map<string, string>();
	for (const name of names) {
		map.set(name, await ensureTranslatorByName(name));
	}
	return map;
}

/**
 * Résout une valeur traducteur/relecteur (nom ou id) vers un id en base.
 * Les noms listés dans `pendingNameToId` sont créés via la soumission.
 */
export async function resolveTranslatorFieldForStorage(
	raw: string | null | undefined,
	pendingNameToId: Map<string, string>
): Promise<string | null> {
	const key = (raw ?? '').trim();
	if (!key) return null;

	const fromPending = pendingNameToId.get(key);
	if (fromPending) return fromPending;

	const [byId] = await db
		.select({ id: translator.id })
		.from(translator)
		.where(eq(translator.id, key))
		.limit(1);
	if (byId) return byId.id;

	const [byName] = await db
		.select({ id: translator.id })
		.from(translator)
		.where(eq(translator.name, key))
		.limit(1);
	if (byName) return byName.id;

	return key;
}
