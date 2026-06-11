import { subscribeAppLogsLive } from '$lib/server/app-logs-live-hub';
import { assertPermission } from '$lib/server/permissions';
import type { RequestHandler } from './$types';

const encoder = new TextEncoder();

const sseEvent = (event: string, data: unknown): Uint8Array =>
	encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

const sseComment = (text: string): Uint8Array => encoder.encode(`: ${text}\n\n`);

export const GET: RequestHandler = async ({ locals, request }) => {
	assertPermission(locals, 'logs.view', 'Accès refusé');

	let closed = false;
	let unsubscribe: (() => void) | null = null;
	let keepaliveId: ReturnType<typeof setInterval> | null = null;

	const stop = () => {
		closed = true;
		if (keepaliveId) clearInterval(keepaliveId);
		keepaliveId = null;
		unsubscribe?.();
		unsubscribe = null;
	};

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			const safeEnqueue = (chunk: Uint8Array) => {
				if (closed) return false;
				try {
					controller.enqueue(chunk);
					return true;
				} catch {
					stop();
					return false;
				}
			};

			safeEnqueue(sseEvent('connected', {}));
			unsubscribe = subscribeAppLogsLive(safeEnqueue);

			keepaliveId = setInterval(() => {
				safeEnqueue(sseComment('keepalive'));
			}, 15000);

			request.signal.addEventListener('abort', () => {
				stop();
				try {
					controller.close();
				} catch {
					// déjà fermé
				}
			});
		},
		cancel() {
			stop();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no'
		}
	});
};
