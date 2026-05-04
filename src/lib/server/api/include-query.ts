/** Valeurs reconnues pour `?include=` (liste séparée par des virgules, insensible à la casse). */
export function parseInclude(searchParams: URLSearchParams): Set<string> {
	const raw = searchParams.get('include');
	const set = new Set<string>();
	if (!raw?.trim()) return set;
	for (const part of raw.split(',')) {
		const t = part.trim().toLowerCase();
		if (t) set.add(t);
	}
	return set;
}
