<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		trigger: Snippet;
		children: Snippet;
		align?: 'end' | 'start';
		menuWidth?: number;
	}

	let { label, trigger, children, align = 'end', menuWidth = 208 }: Props = $props();

	let open = $state(false);
	let menuStyle = $state('');

	const MENU_ESTIMATED_HEIGHT = 200;
	const GAP = 4;

	const close = () => {
		open = false;
	};

	const updatePosition = (button: HTMLButtonElement) => {
		const rect = button.getBoundingClientRect();
		let top = rect.bottom + GAP;
		let left = align === 'end' ? rect.right - menuWidth : rect.left;

		if (top + MENU_ESTIMATED_HEIGHT > window.innerHeight) {
			top = Math.max(GAP, rect.top - MENU_ESTIMATED_HEIGHT - GAP);
		}
		left = Math.max(GAP, Math.min(left, window.innerWidth - menuWidth - GAP));

		menuStyle = `top:${top}px;left:${left}px;width:${menuWidth}px`;
	};

	const toggle = (event: MouseEvent) => {
		event.stopPropagation();
		const button = event.currentTarget as HTMLButtonElement;
		if (open) {
			close();
			return;
		}
		updatePosition(button);
		open = true;
	};

	$effect(() => {
		if (!open) return;

		const onDocClick = () => close();
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') close();
		};
		const onScroll = () => close();
		const onResize = () => close();

		const timeout = setTimeout(() => {
			document.addEventListener('click', onDocClick);
		}, 0);

		document.addEventListener('keydown', onKey);
		window.addEventListener('scroll', onScroll, true);
		window.addEventListener('resize', onResize);

		return () => {
			clearTimeout(timeout);
			document.removeEventListener('click', onDocClick);
			document.removeEventListener('keydown', onKey);
			window.removeEventListener('scroll', onScroll, true);
			window.removeEventListener('resize', onResize);
		};
	});
</script>

<button
	type="button"
	class="btn btn-ghost btn-square btn-sm"
	aria-label={label}
	aria-expanded={open}
	aria-haspopup="menu"
	onclick={toggle}
>
	{@render trigger()}
</button>

{#if open}
	<ul
		role="menu"
		class="menu fixed z-9999 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
		style={menuStyle}
	>
		{@render children()}
	</ul>
{/if}
