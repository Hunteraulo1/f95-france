<script lang="ts">
	import type { Snippet } from 'svelte';

	export type RoleRadioOption = {
		value: string;
		label: string;
		description?: string;
		disabled?: boolean;
	};

	interface Props {
		legend: string;
		hint?: string;
		name: string;
		options: RoleRadioOption[];
		checkedValue: string | null | undefined;
		disabled?: boolean;
		compact?: boolean;
		vertical?: boolean;
		label?: Snippet<[RoleRadioOption]>;
	}

	let {
		legend,
		hint,
		name,
		options,
		checkedValue,
		disabled = false,
		compact = false,
		vertical = false,
		label
	}: Props = $props();

	const interactive = $derived(!disabled);
</script>

<fieldset class="fieldset">
	<legend class="fieldset-legend">{legend}</legend>
	{#if hint}
		<p class="mb-2 text-xs text-base-content/70">{hint}</p>
	{/if}
	<div
		class={vertical
			? 'flex flex-col gap-2'
			: compact
				? 'grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2'
				: 'grid gap-2 sm:grid-cols-2'}
	>
		{#each options as option (option.value)}
			<label
				class="flex items-start gap-3 rounded-lg border border-base-300 p-3 {compact
					? 'gap-2 p-2'
					: ''} {interactive ? 'cursor-pointer hover:bg-base-200' : 'opacity-60'}"
			>
				<input
					type="radio"
					{name}
					value={option.value}
					class="radio mt-0.5 radio-sm"
					checked={checkedValue === option.value}
					disabled={disabled || option.disabled}
				/>
				<span class="flex min-w-0 flex-col gap-0.5">
					{#if label}
						{@render label(option)}
					{:else}
						<span class="text-sm font-medium">{option.label}</span>
					{/if}
					{#if option.description}
						<span class="text-xs opacity-70">{option.description}</span>
					{/if}
				</span>
			</label>
		{/each}
	</div>
</fieldset>
