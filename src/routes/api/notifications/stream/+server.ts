import { countUnreadNotifications } from '$lib/server/notifications';
import type { RequestHandler } from './$types';

const encoder = new TextEncoder();

const sseEvent = (event: string, data: unknown): Uint8Array =>
	encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

const sseComment = (text: string): Uint8Array => encoder.encode(`: ${text}\n\n`);

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return new Response('Non authentifié', { status: 401 });
	}

	const userId = locals.user.id;

	let intervalId: ReturnType<typeof setInterval> | null = null;
	let closed = false;

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			let lastUnread = -1;

			const pushUnreadCount = async () => {
				if (closed) return;
				try {
					const unreadCount = await countUnreadNotifications(userId);
					if (unreadCount !== lastUnread) {
						lastUnread = unreadCount;
						controller.enqueue(sseEvent('unread_count', { unreadCount }));
					} else {
						controller.enqueue(sseComment('keepalive'));
					}
				} catch {
					// On garde la connexion vivante, le client retentera automatiquement.
					controller.enqueue(sseComment('error'));
				}
			};

			void pushUnreadCount();
			intervalId = setInterval(() => {
				void pushUnreadCount();
			}, 15000);
		},
		cancel() {
			closed = true;
			if (intervalId) clearInterval(intervalId);
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
