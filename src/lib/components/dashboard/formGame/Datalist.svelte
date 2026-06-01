<script lang="ts">
	import type { AddTranslatorMode } from '$lib/components/dashboard/add-translator-mode';
	import AddTraductorModal from '$lib/components/dashboard/AddTraductorModal.svelte';
	import type { Translator } from '$lib/server/db/schema';
	import type { FormGameType } from '$lib/types';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import type { ChangeEventHandler, HTMLInputAttributes } from 'svelte/elements';

	interface Props extends HTMLInputAttributes {
		title: string;
		className?: string;
		active?: number[];
		step?: number;
		name: keyof FormGameType;
		game: FormGameType;
		translators?: Translator[];
		/** Erreur bloquante (nom inconnu ou conflit traducteur/relecteur) */
		invalid?: boolean;
		/** direct = création immédiate ; submission = inclus dans la soumission */
		addTranslatorMode?: AddTranslatorMode | false;
		pendingNewTranslators?: string[];
	}

	let {
		title,
		className,
		active,
		step,
		name,
		game = $bindable(),
		translators = $bindable<Translator[]>([]),
		invalid = false,
		addTranslatorMode = false,
		pendingNewTranslators = $bindable<string[]>([])
	}: Props = $props();

	if (!game) throw new Error('no game data');

	const handleChange: ChangeEventHandler<HTMLInputElement> = (event): void => {
		const value = event.currentTarget.value;
		(game[name] as string) = value;
	};

	const handleTranslatorAdded = (value: string) => {
		(game[name] as string) = value;
	};

	let modal = $state(false);
</script>

<div class={className} class:hidden={!step || !active?.includes(step)}>
	<label for={name}>{title}:</label>
	<div class="flex gap-1">
		<input
			placeholder={title}
			type="search"
			id={name}
			list={`traductor-list-${name}`}
			disabled={translators.length === 0 && !addTranslatorMode}
			onchange={handleChange}
			bind:value={game[name]}
			class="input-bordered input mt-1 w-full"
			class:input-error={invalid}
		/>
		<datalist id={`traductor-list-${name}`}>
			{#each translators as item (item.id || item.name)}
				<option>{item.name}</option>
			{/each}
		</datalist>
		{#if addTranslatorMode}
			<button
				type="button"
				class="btn mt-1 w-min btn-primary"
				title={addTranslatorMode === 'submission'
					? 'Proposer un nouveau traducteur (validation à la soumission)'
					: 'Ajouter un traducteur'}
				onclick={(e) => {
					e.preventDefault();
					modal = true;
				}}
			>
				<UserPlus size="1rem" />
			</button>
		{/if}
	</div>
</div>

{#if addTranslatorMode}
	<AddTraductorModal
		bind:showModal={modal}
		bind:translators
		mode={addTranslatorMode === 'submission' ? 'submission' : 'direct'}
		bind:pendingNewTranslators
		onAdded={({ name }) => handleTranslatorAdded(name)}
	/>
{/if}
