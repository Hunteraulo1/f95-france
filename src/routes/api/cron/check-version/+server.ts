import { env } from '$env/dynamic/private';
import { runAutoCheckVersions } from '$lib/server/check-version';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

function hasCronAuth(request: Request): boolean {
	const secret = env.CRON_SECRET?.trim();
	if (!secret) return false;
	const authHeader = request.headers.get('authorization')?.trim();
	const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
	return bearer === secret;
}

function parseReferenceMinutes(reference: string | null | undefined): number {
	const normalized = (reference ?? '00:00').trim();
	const match = normalized.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
	if (!match) return 0;
	const hh = Number.parseInt(match[1]!, 10);
	const mm = Number.parseInt(match[2]!, 10);
	return hh * 60 + mm;
}

export const GET: RequestHandler = async ({ request }) => {
	if (!hasCronAuth(request)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const [cfg] = await db.select().from(table.config).where(eq(table.config.id, 'main')).limit(1);
		const intervalMinutes = cfg?.autoCheckIntervalMinutes ?? 360;
		const referenceMinutes = parseReferenceMinutes(cfg?.autoCheckReferenceTime);
		const lastRunAt = cfg?.autoCheckLastRunAt ? new Date(cfg.autoCheckLastRunAt) : null;
		const now = new Date();
		const intervalMs = intervalMinutes * 60_000;
		const referenceEpoch = Date.UTC(1970, 0, 1, 0, referenceMinutes, 0, 0);
		const elapsedSinceReference = now.getTime() - referenceEpoch;
		const slotIndex = Math.floor(elapsedSinceReference / intervalMs);
		const currentSlotStartMs = referenceEpoch + slotIndex * intervalMs;
		const currentSlotStart = new Date(currentSlotStartMs);
		const nextSlotStart = new Date(currentSlotStartMs + intervalMs);

		if (lastRunAt && lastRunAt.getTime() >= currentSlotStartMs) {
			return json({
				ok: true,
				skipped: true,
				reason: 'slot_already_processed',
				intervalMinutes,
				referenceTime: cfg?.autoCheckReferenceTime ?? '00:00',
				currentSlotStart: currentSlotStart.toISOString(),
				nextRunAt: nextSlotStart.toISOString(),
				nextRunInMinutes: Math.max(1, Math.ceil((nextSlotStart.getTime() - now.getTime()) / 60_000))
			});
		}

		const result = await runAutoCheckVersions();
		await db
			.update(table.config)
			.set({ autoCheckLastRunAt: now, updatedAt: now })
			.where(eq(table.config.id, 'main'));

		return json({ ok: true, ...result });
	} catch (error) {
		console.error('[cron/check-version] erreur:', error);
		return json({ ok: false, error: 'Auto-check failed' }, { status: 500 });
	}
};
