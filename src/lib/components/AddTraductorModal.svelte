<script lang="ts">
	import type { Translator } from '$lib/server/db/schema';

	interface Props {
		showModal: boolean;
		translators: Translator[];
	}

	let { showModal = $bindable(), translators = $bindable() }: Props = $props();

	let newTranslatorName = $state<Translator['name']>();
	let errorMessage = $state<string | null>(null);

	const addTraductor = async () => {
		if (newTranslatorName) {
			errorMessage = null;
			try {
				const response = await fetch('/api/translators', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ name: newTranslatorName })
				});

				if (response.ok) {
					// Recharger la liste complète depuis l'API
					const getResponse = await fetch('/api/translators');
					translators = await getResponse.json();
					newTranslatorName = '';
					showModal = false;
					errorMessage = null;
				} else {
					const errorData = await response.json();
					errorMessage = errorData.error || 'Erreur lors de la création du traducteur';
				}
			} catch (error) {
				console.error('Error creating translator:', error);
				errorMessage = 'Erreur lors de la création du traducteur';
			}
		}
	};
</script>

{#if showModal}
	<div class="modal-open modal">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Ajouter un traducteur</h3>
			<div class="form-control">
				<label class="label" for="newTranslatorName">
					<span class="label-text">Nom du traducteur</span>
				</label>
				<input
					type="text"
					placeholder="Nom du traducteur"
					class="input-bordered input w-full"
					class:input-error={errorMessage}
					bind:value={newTranslatorName}
				/>
				{#if errorMessage}
					<label class="label mt-2" for="newTranslatorName">
						<span class="label-text-alt text-error">{errorMessage}</span>
					</label>
				{/if}
			</div>
			<div class="modal-action">
				<button class="btn btn-primary" onclick={addTraductor}>Ajouter</button>
				<button
					class="btn"
					onclick={() => {
						showModal = false;
					}}>Annuler</button
				>
			</div>
		</div>
	</div>
{/if}
