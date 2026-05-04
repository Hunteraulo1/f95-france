import { env } from '$env/dynamic/private';
import { runAutoCheckVersions } from '$lib/server/check-version';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { json } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

function safeCompareToken(a: string, b: string): boolean {
	const bufA = Buffer.from(a, 'utf8');
	const bufB = Buffer.from(b, 'utf8');
	return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

function hasCronAuth(request: Request): boolean {
	const secret = env.CRON_SECRET?.trim();
	if (!secret) return false;

	const uaRule = env.CRON_ALLOWED_USER_AGENT?.trim();
	if (uaRule) {
		const ua = request.headers.get('user-agent') ?? '';
		if (!ua.includes(uaRule)) return false;
	}

	const authHeader = request.headers.get('authorization')?.trim();
	const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
	return safeCompareToken(bearer, secret);
}

/** Dernière occurrence UTC de l’heure de référence (minutes depuis minuit) strictement ≤ `now`. */
function referenceEpochUtcOnOrBefore(referenceMinutes: number, now: Date): number {
	const ref = new Date(now);
	ref.setUTCHours(0, referenceMinutes, 0, 0);
	let refMs = ref.getTime();
	const nowMs = now.getTime();
	while (refMs > nowMs) {
		refMs -= 86_400_000;
	}
	return refMs;
}

function parseReferenceMinutes(reference: string | null | undefined): number {
	const normalized = (reference ?? '00:00').trim();
	const match = normalized.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
	if (!match) return 0;
	const hh = Number.parseInt(match[1]!, 10);
	const mm = Number.parseInt(match[2]!, 10);
	return hh * 60 + mm;
}

export const POST: RequestHandler = async ({ request }) => {
	if (!hasCronAuth(request)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	console.info('[cron/check-version] déclenché à', new Date().toISOString());

	try {
		const [cfg] = await db.select().from(table.config).where(eq(table.config.id, 'main')).limit(1);
		const intervalMinutes = cfg?.autoCheckIntervalMinutes ?? 360;
		const referenceMinutes = parseReferenceMinutes(cfg?.autoCheckReferenceTime);
		const lastRunAt = cfg?.autoCheckLastRunAt ? new Date(cfg.autoCheckLastRunAt) : null;
		const now = new Date();
		const intervalMs = intervalMinutes * 60_000;
		const referenceEpoch = referenceEpochUtcOnOrBefore(referenceMinutes, now);
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
