<script lang="ts">
	interface Props {
		open: boolean;
		gameName: string;
		reason: string;
		onClose: () => void;
		onConfirm: () => void;
	}

	let { open, gameName, reason = $bindable(''), onClose, onConfirm }: Props = $props();
</script>

{#if open}
	<div class="modal-open modal">
		<div class="modal-box max-h-[90vh] max-w-4xl p-0">
			<div class="p-8">
				<h3 class="mb-4 text-lg font-bold">Confirmer la suppression</h3>
				<p class="mb-6">Êtes-vous sûr de vouloir supprimer toutes les traductions de ce jeu ?</p>
			</div>

			<div class="space-y-5 overflow-y-auto px-8">
				<div class="mb-6 rounded-lg bg-base-200 p-4">
					<p><strong>Jeu :</strong> {gameName}</p>
					<p class="mt-2 text-error">
						<strong>Attention :</strong> Cette action supprimera toutes les traductions associées à ce
						jeu. Le jeu lui-même ne sera pas supprimé.
					</p>
				</div>
				<div class="form-control mb-6 w-full">
					<label class="label" for="game-delete-reason">
						<span class="label-text">
							Raison de la suppression <span class="text-error">*</span>
						</span>
					</label>
					<textarea
						id="game-delete-reason"
						class="textarea-bordered textarea min-h-24 w-full"
						placeholder="Expliquez pourquoi les traductions doivent être retirées…"
						bind:value={reason}></textarea>
				</div>
			</div>

			<div
				class="sticky right-0 bottom-0 left-0 modal-action mt-6 w-full border-t border-base-300 bg-base-100/95 p-4 pt-4 backdrop-blur"
			>
				<button type="button" class="btn btn-ghost" onclick={onClose}>Annuler</button>
				<button type="button" class="btn btn-error" onclick={onConfirm}
					>Supprimer toutes les traductions</button
				>
			</div>
		</div>
	</div>
{/if}
