/** Séquence rotateY inspirée de https://codepen.io/virgilpana/pen/RNYQwB */

const FLIP_DURATION_MS = 400;

const FORWARD_KEYFRAMES: Keyframe[] = [
	{ transform: 'rotateY(0deg)', offset: 0 },
	{ transform: 'rotateY(-10deg)', offset: 0.1 },
	{ transform: 'rotateY(90deg)', offset: 0.35 },
	{ transform: 'rotateY(190deg)', offset: 0.72 },
	{ transform: 'rotateY(180deg)', offset: 1 }
];

const BACKWARD_KEYFRAMES: Keyframe[] = [
	{ transform: 'rotateY(0deg)', offset: 0 },
	{ transform: 'rotateY(10deg)', offset: 0.1 },
	{ transform: 'rotateY(-90deg)', offset: 0.35 },
	{ transform: 'rotateY(-190deg)', offset: 0.72 },
	{ transform: 'rotateY(-180deg)', offset: 1 }
];

export type ProductCardFlipOptions = {
	forward: boolean;
	onRevealBack?: () => void;
};

export const runProductCardFlipAnimation = (
	element: HTMLElement,
	{ forward, onRevealBack }: ProductCardFlipOptions
): Promise<void> => {
	const keyframes = forward ? FORWARD_KEYFRAMES : BACKWARD_KEYFRAMES;
	const revealAt = Math.round(FLIP_DURATION_MS * 0.35);
	let revealTimer: ReturnType<typeof setTimeout> | null = null;

	const animation = element.animate(keyframes, {
		duration: FLIP_DURATION_MS,
		easing: 'ease-in-out',
		fill: 'forwards'
	});

	return new Promise((resolve) => {
		revealTimer = setTimeout(() => {
			onRevealBack?.();
		}, revealAt);

		animation.onfinish = () => {
			if (revealTimer !== null) clearTimeout(revealTimer);
			resolve();
		};

		animation.oncancel = () => {
			if (revealTimer !== null) clearTimeout(revealTimer);
			resolve();
		};
	});
};

export const resetFlipperTransform = (element: HTMLElement) => {
	element.getAnimations().forEach((anim) => anim.cancel());
	element.style.transform = 'rotateY(0deg)';
};
