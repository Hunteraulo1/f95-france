<script lang="ts">
	import type { FormGameType } from '$lib/types';
	import { resolveGameImageSrc } from '$lib/utils/game-image-url';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import Input from './Input.svelte';

	interface Props {
		title: string;
		active?: number[];
		step?: number;
		name: keyof FormGameType;
		game: FormGameType;
		invalid?: boolean;
		warn?: boolean;
		readonly?: boolean;
	}

	const {
		step,
		title,
		active,
		name,
		game = $bindable(),
		invalid = false,
		warn = false,
		readonly = false
	}: Props = $props();

	if (!game) throw new Error('no game data');

	const previewSrc = $derived(resolveGameImageSrc(game.image, { website: game.website }));

	const handleImageError = (e: Event): void => {
		(e.currentTarget as HTMLImageElement).classList.add('hidden');
	};

	const inputAttributes = $derived.by(
		(): HTMLInputAttributes => ({
			onfocusin: (e: FocusEvent) => {
				if (readonly) return;
				(e.currentTarget as HTMLInputElement).nextElementSibling?.classList.remove('hidden');
			},
			onfocusout: (e: FocusEvent) =>
				(e.currentTarget as HTMLInputElement).nextElementSibling?.classList.add('hidden'),
			required: !readonly,
			readonly,
			disabled: readonly
		})
	);
</script>

<Input
	{active}
	{step}
	className="imgHint relative"
	{title}
	{name}
	attributes={inputAttributes}
	{game}
	{invalid}
	{warn}
	type="text"
>
	{#if previewSrc}
		<img
			src={previewSrc}
			alt="bannière du jeu 2"
			class="absolute top-20 z-10 hidden w-full max-w-md rounded-md"
			loading="lazy"
			referrerpolicy="no-referrer"
			onerror={handleImageError}
		/>
	{/if}
</Input>
