<script lang="ts">
	import { getTranslationProgressLabel } from '$lib/utils/game-translation-labels';

	interface TranslationRow {
		tversion: string;
		status: string;
	}

	interface Props {
		translation: TranslationRow | null;
		reason: string;
		onClose: () => void;
		onConfirm: () => void;
	}

	let { translation, reason = $bindable(''), onClose, onConfirm }: Props = $props();
</script>

{#if translation}
	<div class="modal-open modal">
		<div class="modal-box max-h-[90vh] max-w-4xl p-0">
			<div class="p-8">
				<h3 class="mb-4 text-lg font-bold">Confirmer la suppression</h3>
				<p class="mb-6">Êtes-vous sûr de vouloir supprimer cette traduction ?</p>
			</div>

			<div class="space-y-5 overflow-y-auto px-8">
				<div class="rounded-box border border-base-300 bg-base-200/30 p-4 md:p-5">
					<p><strong>Version traduction:</strong> {translation.tversion}</p>
					<p><strong>Statut:</strong> {getTranslationProgressLabel(translation.status)}</p>
				</div>
				<div class="rounded-box border border-base-300 bg-base-200/30 p-4 md:p-5">
					<label class="label" for="translation-delete-reason">
						<span class="label-text">
							Raison de la suppression <span class="text-error">*</span>
						</span>
					</label>
					<textarea
						id="translation-delete-reason"
						class="textarea-bordered textarea min-h-24 w-full"
						placeholder="Expliquez pourquoi cette traduction doit être retirée…"
						bind:value={reason}></textarea>
				</div>
			</div>
			<div
				class="sticky bottom-0 modal-action mt-6 border-t border-base-300 bg-base-100/95 p-4 pt-4 backdrop-blur"
			>
				<button type="button" class="btn btn-ghost" onclick={onClose}>Annuler</button>
				<button type="button" class="btn btn-error" onclick={onConfirm}>Supprimer</button>
			</div>
		</div>
	</div>
{/if}
