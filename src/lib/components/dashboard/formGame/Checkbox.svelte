<script lang="ts">
	import type { FormGameType } from '$lib/types';
	import type { ChangeEventHandler } from 'svelte/elements';

	interface Props {
		title: string;
		active?: number[];
		step?: number;
		name: keyof FormGameType & string;
		game: FormGameType;
		invalid?: boolean;
		warn?: boolean;
	}

	const {
		title,
		active,
		step,
		name,
		game = $bindable(),
		invalid = false,
		warn = false
	}: Props = $props();

	if (!game) throw new Error('no game data');

	const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
		(game[name] as boolean) = event.currentTarget.checked;
	};
</script>

{#if typeof game[name] === 'boolean'}
	<div
		class="flex h-full w-full flex-col justify-center"
		class:hidden={!step || !active?.includes(step)}
	>
		<div class="mb-1 flex items-center gap-2">
			<label for={name} class="mb-1">{title}:</label>
			{#if name === 'gameAutoCheck'}
				<div
					class="tooltip tooltip-right"
					data-tip="Mise à jour automatique des infos du jeu (version du jeu, description, image, tags)"
				>
					<button
						type="button"
						class="btn btn-circle btn-ghost btn-xs"
						aria-label="Aide auto-check jeu"
					>
						?
					</button>
				</div>
			{/if}
			{#if name === 'ac'}
				<div
					class="tooltip tooltip-right"
					data-tip="Mise à jour automatique des infos de la traduction (status, version de référence, moteur)"
				>
					<button
						type="button"
						class="btn btn-circle btn-ghost btn-xs"
						aria-label="Aide auto-check traduction"
					>
						?
					</button>
				</div>
			{/if}
		</div>
		<input
			placeholder={title}
			id={name}
			type="checkbox"
			onchange={handleChange}
			disabled={name === 'ac' && (game.website !== 'f95z' || game.gameAutoCheck === false)}
			bind:checked={game[name]}
			class="checkbox checkbox-lg"
			class:border-error={invalid}
			class:border-warning={warn}
		/>
	</div>
{/if}
