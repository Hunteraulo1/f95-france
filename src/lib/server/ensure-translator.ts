import { buildTranslatorFkResolver } from '$lib/server/api/translation-public';
import { db } from '$lib/server/db';
import { gameTranslation, translator } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
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
	pendingNameToId: Map<string, string> = new Map()
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

	const [byNameCi] = await db
		.select({ id: translator.id })
		.from(translator)
		.where(sql`lower(${translator.name}) = lower(${key})`)
		.limit(1);
	if (byNameCi) return byNameCi.id;

	return null;
}

/** Résout traducteur + relecteur pour persistance en base (écriture directe ou soumission). */
export async function resolveTranslatorContributorIdsForStorage(
	translatorRaw: string | null | undefined,
	proofreaderRaw: string | null | undefined,
	pendingNameToId: Map<string, string> = new Map()
): Promise<{ translatorId: string | null; proofreaderId: string | null }> {
	const [translatorId, proofreaderId] = await Promise.all([
		resolveTranslatorFieldForStorage(translatorRaw, pendingNameToId),
		resolveTranslatorFieldForStorage(proofreaderRaw, pendingNameToId)
	]);
	return { translatorId, proofreaderId };
}

/**
 * Corrige les lignes `game_translation` où `traductor_id` / `proofreader_id` contiennent
 * un nom (legacy) au lieu de l’uuid du traducteur.
 */
export async function repairGameTranslationContributorIdsInDb(): Promise<{
	scanned: number;
	fixedTranslatorId: number;
	fixedProofreaderId: number;
}> {
	const translators = await db
		.select({ id: translator.id, name: translator.name })
		.from(translator);
	const byId = new Set(translators.map((t) => t.id));
	const resolveFk = buildTranslatorFkResolver(translators);

	const rows = await db
		.select({
			id: gameTranslation.id,
			translatorId: gameTranslation.translatorId,
			proofreaderId: gameTranslation.proofreaderId
		})
		.from(gameTranslation);

	let fixedTranslatorId = 0;
	let fixedProofreaderId = 0;

	for (const row of rows) {
		const updates: {
			translatorId?: string | null;
			proofreaderId?: string | null;
		} = {};

		if (row.translatorId && !byId.has(row.translatorId)) {
			const resolved = resolveFk(row.translatorId);
			if (resolved) {
				updates.translatorId = resolved;
				fixedTranslatorId++;
			}
		}
		if (row.proofreaderId && !byId.has(row.proofreaderId)) {
			const resolved = resolveFk(row.proofreaderId);
			if (resolved) {
				updates.proofreaderId = resolved;
				fixedProofreaderId++;
			}
		}

		if (Object.keys(updates).length > 0) {
			await db.update(gameTranslation).set(updates).where(eq(gameTranslation.id, row.id));
		}
	}

	return { scanned: rows.length, fixedTranslatorId, fixedProofreaderId };
}
