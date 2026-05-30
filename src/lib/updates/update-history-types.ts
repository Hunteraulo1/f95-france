export type UpdateHistoryAction = 'created' | 'status_changed' | 'deleted';

export type TranslationHistorySnapshot = {
	translationName?: string | null;
	version?: string | null;
	tversion?: string;
	status?: string;
	ttype?: string;
	tlink?: string;
	tname?: string;
	gameType?: string;
	translatorId?: string | null;
	proofreaderId?: string | null;
	ac?: boolean;
};

export type UpdateHistoryFieldDelta = {
	field: string;
	oldValue: unknown;
	newValue: unknown;
};

export type TranslationUpdateHistoryChanges = {
	entity: 'translation';
	translationId: string;
	deltas: UpdateHistoryFieldDelta[];
};

export type UpdateHistoryContext = {
	userId?: string | null;
	action: UpdateHistoryAction;
	changes: TranslationUpdateHistoryChanges;
};

export const GAME_UPDATE_HISTORY_PAGE_SIZE = 15;

/** Entrée d’historique traduction (partagé client / serveur). */
export type GameUpdateHistoryEntry = {
	id: string;
	action: UpdateHistoryAction;
	createdAt: Date;
	userId: string | null;
	username: string | null;
	updateId: string;
	updateStatus: string;
	changes: TranslationUpdateHistoryChanges | null;
	revertible: boolean;
	revertCascadeCount: number;
};

export type GameUpdateHistoryPage = {
	entries: GameUpdateHistoryEntry[];
	totalCount: number;
	page: number;
	totalPages: number;
	pageSize: number;
};
