import { boolFromRecord, strFromRecord } from '$lib/forms/dev-action';

export type SheetsDetails = { title?: string; spreadsheetId?: string; sheets?: string[] };
export type ScrapeDetails = {
	name: string | null;
	version: string | null;
	status: string | null;
	tags: string | null;
	type: string | null;
	image: string | null;
};
export type TestResult = {
	success: boolean;
	message: string;
	details: string | SheetsDetails | null;
};
export type ScrapeResult = {
	success: boolean;
	message: string;
	details: string | ScrapeDetails | null;
};
export type WebhookTestResult = {
	success: boolean;
	message: string;
	details: string | null;
	channel: string | null;
	httpStatus: number | null;
};
export type TranslatorMpTestResult = {
	success: boolean;
	message: string;
	method: 'dm' | 'channel_fallback' | null;
	details: string | null;
};
export type DbSheetSyncResult = {
	success: boolean;
	message: string;
	details:
		| string
		| {
				totalTranslations: number;
				totalTranslators: number;
				syncedTranslations: number;
				syncedTranslators: number;
				prunedJeuxRows?: number;
				dedupedJeuxRows?: number;
				repairedContributorIds?: number;
				errors: string[];
		  }
		| null;
};
export type AutoCheckManualResult = {
	success: boolean;
	message: string;
	details:
		| string
		| {
				scannedGames: number;
				updatedGames: number;
				updatedTranslations: number;
				disabledAlignedGames: number;
				translatorDmsSent?: number;
				translatorWebhooksSent?: number;
				proofreaderWebhooksSent?: number;
		  }
		| null;
};

export const isSheetsDetails = (value: unknown): value is SheetsDetails =>
	typeof value === 'object' && value !== null;
export const isScrapeDetailsObject = (value: unknown): value is ScrapeDetails =>
	typeof value === 'object' && value !== null;
export const mapAutoCheckResult = (data: Record<string, unknown>): AutoCheckManualResult => ({
	success: boolFromRecord(data, 'success'),
	message: strFromRecord(data, 'message'),
	details:
		typeof data.details === 'string' ||
		data.details === null ||
		(typeof data.details === 'object' && data.details !== null)
			? (data.details as AutoCheckManualResult['details'])
			: null
});

export const mapSheetsTestResult = (data: Record<string, unknown>): TestResult => {
	const detailsRaw = 'details' in data ? data.details : null;
	const details =
		typeof detailsRaw === 'string' || detailsRaw === null || isSheetsDetails(detailsRaw)
			? (detailsRaw as TestResult['details'])
			: null;
	return {
		success: boolFromRecord(data, 'success'),
		message: strFromRecord(data, 'message', data.success === false ? 'Erreur inconnue' : ''),
		details
	};
};

export const mapScrapeResult = (data: Record<string, unknown>): ScrapeResult => {
	const detailsRaw = 'details' in data ? data.details : null;
	const details =
		typeof detailsRaw === 'string' || detailsRaw === null || isScrapeDetailsObject(detailsRaw)
			? (detailsRaw as ScrapeResult['details'])
			: null;
	return {
		success: boolFromRecord(data, 'success'),
		message: strFromRecord(data, 'message', 'Erreur inconnue'),
		details
	};
};

export const mapWebhookTestResult = (data: Record<string, unknown>): WebhookTestResult => ({
	success: boolFromRecord(data, 'success'),
	message: strFromRecord(data, 'message', 'Erreur'),
	details: typeof data.details === 'string' || data.details === null ? data.details : null,
	channel: typeof data.channel === 'string' ? data.channel : null,
	httpStatus:
		typeof data.httpStatus === 'number' || data.httpStatus === null ? data.httpStatus : null
});

export const mapTranslatorMpTestResult = (
	data: Record<string, unknown>
): TranslatorMpTestResult => ({
	success: boolFromRecord(data, 'success'),
	message: strFromRecord(data, 'message', 'Erreur'),
	method: data.method === 'dm' || data.method === 'channel_fallback' ? data.method : null,
	details: typeof data.details === 'string' || data.details === null ? data.details : null
});

export const mapDbSheetSyncResult = (data: Record<string, unknown>): DbSheetSyncResult => ({
	success: boolFromRecord(data, 'success'),
	message: strFromRecord(data, 'message'),
	details:
		typeof data.details === 'string' ||
		data.details === null ||
		(typeof data.details === 'object' && data.details !== null)
			? (data.details as DbSheetSyncResult['details'])
			: null
});
