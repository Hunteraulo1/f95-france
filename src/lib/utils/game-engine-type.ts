import type { GameEngineType } from '$lib/types';

const ALLOWED = ['renpy', 'rpgm', 'unity', 'unreal', 'flash', 'html', 'qsp', 'other'] as const;

export function coerceGameEngineType(value: string | null | undefined): GameEngineType {
	const v = String(value ?? 'other')
		.toLowerCase()
		.trim();
	if ((ALLOWED as readonly string[]).includes(v)) return v as GameEngineType;
	return 'other';
}
