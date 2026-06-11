import { cubicInOut } from 'svelte/easing';
import type { TransitionConfig } from 'svelte/transition';

type HeroTransitionOptions = {
	duration?: number;
	delay?: number;
};

/** Fondu pur — opacité uniquement, sans translation ni scale. */
export function heroFadeOnly(
	node: Element,
	{ duration = 420, delay = 0 }: HeroTransitionOptions = {}
): TransitionConfig {
	return {
		duration,
		delay,
		easing: cubicInOut,
		css: (t) => `opacity: ${t};`
	};
}
