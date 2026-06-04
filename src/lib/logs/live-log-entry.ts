/** Entrée diffusée en temps réel sur `/api/logs/live` (WebSocket). */
export type LiveLogEntry = {
	id: string;
	method: string;
	route: string;
	status: number;
	ipAddress: string | null;
	payload: string | null;
	errorMessage: string | null;
	createdAt: string;
	user: {
		id: string;
		username: string;
		role: string;
	} | null;
};

export type LogsLiveServerMessage =
	| { type: 'connected' }
	| { type: 'log'; entry: LiveLogEntry };
