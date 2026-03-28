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
		invalid?: boolean;
		warn?: boolean;
	}

	const {
		title,
		className,
		active,
		step,
		name,
		game = $bindable(),
		invalid = false,
		warn = false,
		...rest
	}: Props = $props();

	if (!game) throw new Error('no game data');

	const stringValue = $derived(
		game[name] == null ? '' : String(game[name] as string | number | boolean)
	);

	const handleInput: ChangeEventHandler<HTMLTextAreaElement> = (event) => {
		(game[name] as string) = event.currentTarget.value;
	};
</script>

<div class={className} class:hidden={!step || !active?.includes(step)}>
	<label for={name}>{title}:</label>
	<div class="flex gap-1">
		<textarea
			placeholder={title}
			id={name}
			oninput={handleInput}
			value={stringValue}
			class="textarea-bordered textarea h-10 max-h-32 min-h-10 w-full textarea-xs"
			class:textarea-error={invalid}
			class:textarea-warning={warn}
			{...rest}
		></textarea>
	</div>
</div>
