<script lang="ts">
	let {
		selectedStatus = $bindable('pending'),
		adminNotesText = $bindable(''),
		statusError = null,
		hasNotesError = false,
		isStatusRequiringAdminNote = false,
		canModerateSubmission = false,
		onClose
	}: {
		selectedStatus?: string;
		adminNotesText?: string;
		statusError?: string | null;
		hasNotesError?: boolean;
		isStatusRequiringAdminNote?: boolean;
		canModerateSubmission?: boolean;
		onClose: () => void;
	} = $props();
</script>

{#if canModerateSubmission}
	<div class="mt-6 border-t border-base-300 pt-4">
		<h4 class="text-md mb-4 font-semibold">Modifier le statut</h4>

		{#if statusError}
			<div class="mb-4 alert alert-error">
				<span>{statusError}</span>
			</div>
		{/if}

		<div class="form-control w-full">
			<label for="status" class="label">
				<span class="label-text">Statut</span>
			</label>
			<select
				id="status"
				name="status"
				class="select-bordered select w-full"
				class:select-error={statusError}
				bind:value={selectedStatus}
				required
			>
				<option value="pending">En attente</option>
				<option value="opened">Ouverte</option>
				<option value="to_fix">À corriger</option>
				<option value="accepted">Acceptée</option>
				<option value="rejected">Refusée</option>
			</select>
		</div>

		<div class="form-control mt-4 w-full">
			<label for="adminNotes" class="label">
				<span class="label-text">Notes admin</span>
				{#if isStatusRequiringAdminNote}
					<span class="label-text-alt text-error">* Obligatoire</span>
				{:else}
					<span class="label-text-alt">(optionnel)</span>
				{/if}
			</label>
			<textarea
				id="adminNotes"
				name="adminNotes"
				class="textarea-bordered textarea w-full"
				class:textarea-error={hasNotesError}
				placeholder={isStatusRequiringAdminNote
					? 'Vous devez expliquer pourquoi cette soumission est à corriger ou refusée...'
					: 'Ajouter des notes pour cette soumission...'}
				rows="3"
				required={isStatusRequiringAdminNote}
				bind:value={adminNotesText}
			></textarea>
			{#if isStatusRequiringAdminNote}
				<div class="label">
					<span class="label-text-alt text-error">
						Une note est obligatoire pour "À corriger" ou "Refusée"
					</span>
				</div>
			{/if}
		</div>
		<div class="modal-action mt-4">
			<button type="submit" form="submission-save-form" class="btn btn-primary">
				Enregistrer
			</button>
		</div>
	</div>
{:else}
	<div class="modal-action mt-4">
		<button type="button" class="btn" onclick={onClose}> Fermer </button>
	</div>
{/if}
