import type { GameEngineType } from '$lib/types';

export const EXTRACT_DRAFT_COOKIE = 'f95_extract_draft';

export type ExtractDraftWebsite = 'f95z' | 'lc';

/** Brouillon prérempli pour `/dashboard/manager/add` après extract en mode soumission. */
export type ManagerExtractDraft = {
	website: ExtractDraftWebsite;
	threadId: number;
	name: string;
	tags: string;
	gameType: GameEngineType;
	image: string;
	link: string;
	description: string | null;
	gameVersion: string | null;
	gameAutoCheck: boolean;
};

export function parseExtractDraftCookie(raw: string | undefined): ManagerExtractDraft | null {
	if (!raw?.trim()) return null;
	try {
		const parsed = JSON.parse(raw) as ManagerExtractDraft;
		if (parsed.website !== 'f95z' && parsed.website !== 'lc') return null;
		if (!Number.isFinite(parsed.threadId) || parsed.threadId <= 0) return null;
		if (typeof parsed.name !== 'string' || !parsed.name.trim()) return null;
		return parsed;
	} catch {
		return null;
	}
}
