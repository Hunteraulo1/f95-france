<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		open: boolean;
		title: string;
		description?: string;
		maxWidthClass?: string;
		scrollBody?: boolean;
		children: Snippet;
		footer?: Snippet;
		onClose: () => void;
	}

	let {
		open,
		title,
		description,
		maxWidthClass = 'max-w-lg',
		scrollBody = false,
		children,
		footer,
		onClose
	}: Props = $props();
</script>

{#if open}
	<dialog class="modal-open modal">
		<div class="modal-box {maxWidthClass} {scrollBody ? 'max-h-[90vh] overflow-y-auto' : ''}">
			<h3 class="text-lg font-bold">{title}</h3>
			{#if description}
				<p class="mt-1 text-sm text-base-content/70">{description}</p>
			{/if}
			<div class="mt-4">
				{@render children()}
			</div>
			{#if footer}
				<div class="modal-action">
					{@render footer()}
				</div>
			{/if}
		</div>
		<form method="dialog" class="modal-backdrop">
			<button type="button" onclick={onClose}>Fermer</button>
		</form>
	</dialog>
{/if}
