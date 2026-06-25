import type { GameTranslation } from '$lib/server/db/schema';

export type SubmissionPrimitive = string | number | boolean | null | undefined;

export interface GameSubmissionJson {
	name?: string | null;
	description?: string | null;
	type?: string | null;
	website?: string | null;
	threadId?: string | number | null;
	tags?: string | null;
	link?: string | null;
	image?: string | null;
	gameVersion?: string | null;
	gameAutoCheck?: boolean | null;
}

export interface SubmissionFieldConfig<
	T extends GameTranslation | GameSubmissionJson = GameTranslation | GameSubmissionJson
> {
	key: Extract<keyof T, string>;
	label: string;
	options?: {
		isMultiline?: boolean;
		isUrl?: boolean;
		showIfEmpty?: boolean;
	};
}

export interface SubmissionModalItem {
	id: string;
	status: string;
	type: string;
	gameId?: string | null;
	translationId?: string | null;
	adminNotes?: string | null;
	parsedData?: {
		game?: GameSubmissionJson;
		translation?: GameTranslation;
		translatorId?: string;
		pages?: Array<{ name?: string; link?: string }>;
		originalPages?: Array<{ name?: string; link?: string }>;
		reason?: string;
		gameId?: string;
		translationId?: string;
	} | null;
	currentGame?: GameSubmissionJson | null;
	currentTranslation?: GameTranslation | null;
	currentTranslator?: {
		id: string;
		name: string;
		pages: Array<{ name: string; link: string }>;
	} | null;
	user?: {
		id: string;
		username: string;
		role?: string;
	} | null;
	openedByUser?: {
		id: string;
		username: string;
		role?: string;
	} | null;
	reviewedByUser?: {
		id: string;
		username: string;
		role?: string;
	} | null;
}

export interface SubmissionModalTranslator {
	id: string;
	name: string;
	userId?: string | null;
	username?: string | null;
}
