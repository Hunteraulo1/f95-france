import type { LiveLogEntry } from '$lib/logs/live-log-entry';

export type LogsLiveEnqueue = (chunk: Uint8Array) => boolean;

const subscribers = new Set<LogsLiveEnqueue>();

export function subscribeLogsLive(enqueue: LogsLiveEnqueue) {
	subscribers.add(enqueue);
	return () => subscribers.delete(enqueue);
}

export function broadcastLiveLogEntry(entry: LiveLogEntry) {
	if (subscribers.size === 0) return;

	const payload = JSON.stringify({ entry });
	const chunk = new TextEncoder().encode(`event: log\ndata: ${payload}\n\n`);

	for (const enqueue of [...subscribers]) {
		if (!enqueue(chunk)) {
			subscribers.delete(enqueue);
		}
	}
}
