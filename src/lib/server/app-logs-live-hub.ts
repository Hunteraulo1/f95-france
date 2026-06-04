import type { LiveAppLogEntry } from '$lib/logs/live-app-log-entry';

export type AppLogsLiveEnqueue = (chunk: Uint8Array) => boolean;

const subscribers = new Set<AppLogsLiveEnqueue>();

export function subscribeAppLogsLive(enqueue: AppLogsLiveEnqueue) {
	subscribers.add(enqueue);
	return () => subscribers.delete(enqueue);
}

export function broadcastLiveAppLogEntry(entry: LiveAppLogEntry) {
	if (subscribers.size === 0) return;

	const payload = JSON.stringify({ entry });
	const chunk = new TextEncoder().encode(`event: log\ndata: ${payload}\n\n`);

	for (const enqueue of [...subscribers]) {
		if (!enqueue(chunk)) {
			subscribers.delete(enqueue);
		}
	}
}
