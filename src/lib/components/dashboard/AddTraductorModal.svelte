<script lang="ts">
	import type { AddTranslatorMode } from '$lib/components/dashboard/add-translator-mode';

	type TranslatorListEntry = { id: string; name: string };

	interface Props {
		showModal: boolean;
		translators: TranslatorListEntry[];
		mode?: AddTranslatorMode;
		pendingNewTranslators?: string[];
		onAdded?: (payload: { name: string }) => void;
	}

	let {
		showModal = $bindable(),
		translators = $bindable<TranslatorListEntry[]>([]),
		mode = 'direct',
		pendingNewTranslators = $bindable<string[]>([]),
		onAdded
	}: Pick<
		Props,
		'showModal' | 'translators' | 'mode' | 'pendingNewTranslators' | 'onAdded'
	> = $props();

	let newTranslatorName = $state('');
	let errorMessage = $state<string | null>(null);

	const pendingPlaceholderTranslator = (name: string): TranslatorListEntry => ({
		id: `pending:${name}`,
		name
	});

	const addTraductor = async () => {
		if (!newTranslatorName) return;

		const trimmed = newTranslatorName.trim();
		if (!trimmed) {
			errorMessage = 'Le nom est requis';
			return;
		}
		if (translators.some((item) => item.name === trimmed)) {
			errorMessage = 'Ce traducteur existe déjà';
			return;
		}

		errorMessage = null;

		if (mode === 'submission') {
			if (!pendingNewTranslators.includes(trimmed)) {
				pendingNewTranslators = [...pendingNewTranslators, trimmed];
			}
			translators = [...translators, pendingPlaceholderTranslator(trimmed)];
			newTranslatorName = '';
			showModal = false;
			errorMessage = null;
			onAdded?.({ name: trimmed });
			return;
		}

		try {
			const response = await fetch('/dashboard/translators', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ name: trimmed })
			});

			if (response.ok) {
				const data = (await response.json()) as { translators?: TranslatorListEntry[] };
				if (Array.isArray(data.translators)) {
					translators = data.translators;
				}
				newTranslatorName = '';
				showModal = false;
				errorMessage = null;
				onAdded?.({ name: trimmed });
			} else {
				const errorData = (await response.json()) as { error?: string };
				errorMessage = errorData.error || 'Erreur lors de la création du traducteur';
			}
		} catch (error) {
			console.error('Error creating translator:', error);
			errorMessage = 'Erreur lors de la création du traducteur';
		}
	};
</script>

{#if showModal}
	<div class="modal-open modal">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Ajouter un traducteur</h3>
			{#if mode === 'submission'}
				<p class="mt-1 text-sm text-base-content/70">
					Le traducteur sera créé lors de la validation de votre soumission par un administrateur.
				</p>
			{/if}
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
				<button type="button" class="btn btn-primary" onclick={addTraductor}>Ajouter</button>
				<button
					type="button"
					class="btn"
					onclick={() => {
						showModal = false;
					}}>Annuler</button
				>
			</div>
		</div>
	</div>
{/if}
