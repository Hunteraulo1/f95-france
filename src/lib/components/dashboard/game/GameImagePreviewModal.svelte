<script lang="ts">
	interface Props {
		open: boolean;
		imageSrc: string;
		alt: string;
		onClose: () => void;
	}

	let { open, imageSrc, alt, onClose }: Props = $props();
</script>

{#if open}
	<div class="modal-open modal" role="dialog" aria-modal="true" aria-label="Aperçu image du jeu">
		<div class="modal-box max-h-[90vh] max-w-5xl p-2 sm:p-4">
			<img
				src={imageSrc}
				{alt}
				class="mx-auto max-h-[80vh] w-auto max-w-full rounded-lg object-contain"
				referrerpolicy="no-referrer"
			/>
			<div class="modal-action mt-3">
				<button type="button" class="btn btn-ghost" onclick={onClose}>Fermer</button>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button type="button" onclick={onClose}>Fermer</button>
		</form>
	</div>
{/if}
