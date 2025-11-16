<script lang="ts">
	import type { FormGameType } from '$lib/types';
	import type { ChangeEventHandler, HTMLTextareaAttributes } from 'svelte/elements';

	interface Props extends HTMLTextareaAttributes {
		title: string;
		className?: string;
		active?: number[];
		step?: number;
		name: keyof FormGameType;
		game: FormGameType;
	}

	const { title, className, active, step, name, game = $bindable() }: Props = $props();

	if (!game) throw new Error('no game data');

	const handleChange: ChangeEventHandler<HTMLTextAreaElement> = (event) => {
		(game[name] as FormGameType[keyof FormGameType]) = event.currentTarget.value;
	};
</script>

<div class={className} class:hidden={!step || !active?.includes(step)}>
	<label for={name}>{title}:</label>
	<div class="flex gap-1">
		<textarea
			placeholder={title}
			id={name}
			onchange={handleChange}
			class="textarea-bordered textarea h-10 max-h-32 min-h-10 w-full textarea-xs"
			>{game[name]}</textarea
		>
	</div>
</div>
