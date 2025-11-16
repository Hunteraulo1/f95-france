<script lang="ts">
	import type { FormGameType } from '$lib/types';
	import { checkRole } from '$lib/utils';
	import type { ChangeEventHandler } from 'svelte/elements';

	interface Props {
		title: string;
		active?: number[];
		step?: number;
		name: keyof FormGameType & string;
		game: FormGameType;
	}

	const { title, active, step, name, game = $bindable() }: Props = $props();

	if (!game) throw new Error('no game data');

	const error = $state(false);

	const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
		(game[name] as boolean) = event.currentTarget.checked;
	};
</script>

{#if typeof game[name] === 'boolean'}
	<div
		class="flex h-full w-full flex-col justify-center"
		class:hidden={!step || !active?.includes(step) || !checkRole(['admin', 'superadmin'])}
	>
		<label for={name}>{title}:</label>
		<input
			placeholder={title}
			id={name}
			type="checkbox"
			onchange={handleChange}
			disabled={name === 'ac' && game.website !== 'f95z'}
			bind:checked={game[name]}
			class="checkbox checkbox-lg"
			class:border-error={error}
		/>
	</div>
{/if}
