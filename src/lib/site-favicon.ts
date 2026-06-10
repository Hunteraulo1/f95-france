import type { SiteEnvBadge } from '$lib/site-host';

const DEFAULT_FAVICON = '/favicon.ico';

function drawRoundedRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number
) {
	ctx.beginPath();
	ctx.moveTo(x + radius, y);
	ctx.lineTo(x + width - radius, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
	ctx.lineTo(x + width, y + height - radius);
	ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
	ctx.lineTo(x + radius, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
	ctx.lineTo(x, y + radius);
	ctx.quadraticCurveTo(x, y, x + radius, y);
	ctx.closePath();
}

export async function applyFaviconEnvBadge(
	badge: SiteEnvBadge | null,
	sourceIcon = DEFAULT_FAVICON
): Promise<void> {
	const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
	if (!link) return;

	if (!badge) {
		link.href = sourceIcon;
		return;
	}

	const img = new Image();
	img.src = sourceIcon;

	try {
		await img.decode();
	} catch {
		link.href = sourceIcon;
		return;
	}

	const size = 32;
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext('2d');
	if (!ctx) return;

	ctx.drawImage(img, 0, 0, size, size);

	const badgeWidth = 15;
	const badgeHeight = 11;
	const badgeX = size - badgeWidth + 1;
	const badgeY = 0;

	ctx.fillStyle = badge.background;
	drawRoundedRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 2);
	ctx.fill();

	ctx.fillStyle = badge.foreground;
	ctx.font = 'bold 5.5px system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(badge.label, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2 + 0.5);

	link.href = canvas.toDataURL('image/png');
}
