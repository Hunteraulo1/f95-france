<script lang="ts">
	import type { AddTranslatorMode } from '$lib/components/dashboard/add-translator-mode';
	import AddTraductorModal from '$lib/components/dashboard/AddTraductorModal.svelte';
	import UserPlus from '@lucide/svelte/icons/user-plus';

	type TranslatorOption = { id: string; name: string };

	interface Props {
		id: string;
		listId: string;
		label: string;
		placeholder?: string;
		value: string;
		baseTranslators: TranslatorOption[];
		extraTranslators?: TranslatorOption[];
		addTranslatorMode?: AddTranslatorMode | false;
		pendingNewTranslators?: string[];
		inputClass?: string;
		/** Après création directe en base (recharger la liste serveur). */
		onDirectTranslatorCreated?: () => void;
	}

	let {
		id,
		listId,
		label,
		placeholder = 'Nom',
		value = $bindable(),
		baseTranslators,
		extraTranslators = $bindable<TranslatorOption[]>([]),
		addTranslatorMode = false,
		pendingNewTranslators = $bindable<string[]>([]),
		inputClass = 'input-bordered input w-full',
		onDirectTranslatorCreated
	}: Props = $props();

	const listTranslators = $derived([...baseTranslators, ...extraTranslators]);

	let modal = $state(false);
	let modalTranslators = $state<TranslatorOption[]>([]);

	const openModal = () => {
		modalTranslators = [...listTranslators];
		modal = true;
	};
</script>

<div class="form-control w-full">
	<label class="label" for={id}>
		<span class="label-text">{label}</span>
	</label>
	<div class="flex gap-1">
		<input {id} class={inputClass} type="text" list={listId} bind:value {placeholder} />
		<datalist id={listId}>
			{#each listTranslators as translator (translator.id)}
				<option value={translator.name}>{translator.name}</option>
			{/each}
		</datalist>
		{#if addTranslatorMode}
			<button
				type="button"
				class="btn shrink-0 btn-primary"
				title={addTranslatorMode === 'submission'
					? 'Proposer un nouveau nom (validation à la soumission)'
					: 'Ajouter un traducteur'}
				onclick={openModal}
			>
				<UserPlus size="1rem" />
			</button>
		{/if}
	</div>
</div>

{#if addTranslatorMode === 'submission'}
	<AddTraductorModal
		bind:showModal={modal}
		bind:translators={extraTranslators}
		mode="submission"
		bind:pendingNewTranslators
		onAdded={({ name }) => {
			value = name;
		}}
	/>
{:else if addTranslatorMode === 'direct'}
	<AddTraductorModal
		bind:showModal={modal}
		bind:translators={modalTranslators}
		mode="direct"
		onAdded={({ name }) => {
			value = name;
			onDirectTranslatorCreated?.();
		}}
	/>
{/if}
