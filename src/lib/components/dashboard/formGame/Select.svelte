<script lang="ts">
	import { isNoTranslation } from '$lib/utils/game-form-validation';
	import type { FormGameType } from '$lib/types';
	import type { ChangeEventHandler } from 'svelte/elements';

	interface SelectOption {
		value: string;
		label: string;
	}

	interface Props {
		values?: Array<FormGameType[keyof FormGameType]>;
		/** Alternative à `values` : options avec value / libellé (ex. statut de traduction) */
		selectOptions?: SelectOption[];
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
		values = [],
		selectOptions,
		title,
		className,
		active,
		step,
		name,
		game = $bindable(),
		invalid = false,
		warn = false
	}: Props = $props();

	if (!game) throw new Error('no game data');

	let ttypeLocked = $derived(name === 'ttype' && isNoTranslation(game.tname));

	const handleChange: ChangeEventHandler<HTMLSelectElement> = (event) => {
		const val = event.currentTarget.value;

		if (name === 'tname') {
			(game[name] as string) = val;
			if (val === 'no_translation') {
				game.tversion = '';
				game.tlink = '';
				game.ttype = 'hs';
			} else if (val === 'integrated') {
				game.tversion = 'Intégrée';
				game.tlink = '';
			} else {
				/* Traduction / Traduction (avec mods) : débloquer les champs, retirer la valeur figée « Intégrée » */
				if (game.tversion === 'Intégrée') {
					game.tversion = '';
				}
			}
			return;
		}

		(game[name] as FormGameType[keyof FormGameType]) = val;

		if (name === 'website') {
			if (game.website !== 'f95z') {
				game.ac = false;
				game.gameAutoCheck = false;
			} else {
				game.gameAutoCheck = true;
			}

			const gameId = game.threadId;

			if (!gameId || gameId === 0) {
				game.link = '';
			} else {
				switch (game.website) {
					case 'f95z':
						game.link = `https://f95zone.to/threads/${gameId}`;
						break;
					case 'lc':
						game.link = `https://lewdcorner.com/threads/${gameId}`;
						break;
					default:
						game.link = '';
						break;
				}
			}
		}
	};
</script>

<div class={className} class:hidden={step !== undefined && !active?.includes(step)}>
	<label for={name}>{title}:</label>
	<select
		placeholder={title}
		id={name}
		onchange={handleChange}
		bind:value={game[name]}
		disabled={ttypeLocked}
		class="select-bordered select w-full"
		class:select-error={invalid}
		class:select-warning={warn}
	>
		{#if selectOptions?.length}
			{#each selectOptions as opt (opt.value)}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		{:else}
			{#each Object.values(values) as value (value)}
				<option>{value}</option>
			{/each}
		{/if}
	</select>
</div>
