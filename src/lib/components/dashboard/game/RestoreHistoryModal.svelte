<script lang="ts">
	import {
		formatUpdateHistoryDate,
		formatUpdateHistoryFieldValue,
		getUpdateHistoryActionBadgeClass,
		getUpdateHistoryActionLabel,
		getUpdateHistoryFieldLabel,
		resolveHistoryTranslationName,
		visibleHistoryDeltas
	} from '$lib/updates/update-history-display';
	import type { GameUpdateHistoryEntry } from '$lib/updates/update-history-types';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import History from '@lucide/svelte/icons/history';
	import Undo2 from '@lucide/svelte/icons/undo-2';

	type TranslatorRow = { id: string; name: string };
	type TranslationRow = { id: string; translationName: string | null };

	interface Props {
		entry: GameUpdateHistoryEntry | null;
		translators: TranslatorRow[];
		translations: TranslationRow[];
		confirming?: boolean;
		onClose: () => void;
		onConfirm: () => void;
	}

	let {
		entry,
		translators,
		translations,
		confirming = false,
		onClose,
		onConfirm
	}: Props = $props();

	const translatorLookup = $derived(translators.map((t) => ({ id: t.id, name: t.name })));

	const changes = $derived(entry?.changes ?? null);
	const deltas = $derived(
		entry && changes ? visibleHistoryDeltas(entry.action, changes.deltas) : []
	);
	const translationLabel = $derived(
		changes
			? resolveHistoryTranslationName(changes.translationId, changes.deltas, translations)
			: 'Traduction'
	);
</script>

{#if entry}
	<div
		class="modal-open modal"
		role="dialog"
		aria-modal="true"
		aria-labelledby="restore-history-title"
	>
		<div class="modal-box max-w-lg p-0">
			<div class="border-b border-base-300 px-6 py-5">
				<div class="flex items-start gap-3">
					<div class="rounded-box bg-primary/10 p-2 text-primary">
						<Undo2 size={20} />
					</div>
					<div class="min-w-0 flex-1">
						<h3 id="restore-history-title" class="text-lg font-bold text-base-content">
							Restaurer cet état
						</h3>
						<p class="mt-1 text-sm text-base-content/70">
							Revenir à l’état d’avant la modification sélectionnée pour
							<span class="font-medium text-base-content">« {translationLabel} »</span>.
						</p>
					</div>
				</div>
			</div>

			<div class="space-y-4 px-6 py-5">
				{#if entry.revertCascadeCount > 1}
					<div role="alert" class="alert alert-soft alert-warning">
						<AlertTriangle size={18} class="shrink-0" />
						<div class="text-sm">
							<p class="font-medium">Restauration en cascade</p>
							<p class="text-base-content/80">
								{entry.revertCascadeCount} changement(s) seront pris en compte, y compris les modifications
								plus récentes sur cette traduction.
							</p>
						</div>
					</div>
				{/if}

				<div class="space-y-3 rounded-box border border-base-300 bg-base-200/40 p-4">
					<div class="flex flex-wrap items-center gap-2">
						<span class="badge badge-sm {getUpdateHistoryActionBadgeClass(entry.action)}">
							{getUpdateHistoryActionLabel(entry.action)}
						</span>
						<span class="text-xs text-base-content/60"
							>{formatUpdateHistoryDate(entry.createdAt)}</span
						>
					</div>

					<p class="text-sm text-base-content/70">
						{#if entry.username}
							Par <span class="font-medium text-base-content">{entry.username}</span>
						{:else}
							Par le système
						{/if}
					</p>

					{#if deltas.length > 0}
						<div class="space-y-1.5">
							<p class="text-xs font-medium tracking-wide text-base-content/60 uppercase">
								Changements concernés
							</p>
							<ul class="space-y-1 text-sm">
								{#each deltas as delta (delta.field)}
									<li class="rounded-md bg-base-100/80 px-2.5 py-1.5">
										<span class="font-medium">{getUpdateHistoryFieldLabel(delta.field)}</span>
										{#if entry.action === 'created'}
											<span class="text-base-content/70">
												→ {formatUpdateHistoryFieldValue(
													delta.field,
													delta.newValue,
													translatorLookup
												)}
											</span>
										{:else if entry.action === 'deleted'}
											<span class="text-base-content/70">
												{formatUpdateHistoryFieldValue(
													delta.field,
													delta.oldValue,
													translatorLookup
												)}
											</span>
										{:else}
											<span class="text-base-content/70">
												{formatUpdateHistoryFieldValue(
													delta.field,
													delta.oldValue,
													translatorLookup
												)}
												→
												{formatUpdateHistoryFieldValue(
													delta.field,
													delta.newValue,
													translatorLookup
												)}
											</span>
										{/if}
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>

				<div role="alert" class="alert alert-soft alert-info">
					<History size={18} class="shrink-0" />
					<span class="text-sm">Cette action sera tracée dans l’historique.</span>
				</div>
			</div>

			<div
				class="flex justify-end gap-2 border-t border-base-300 bg-base-100/95 px-6 py-4 backdrop-blur"
			>
				<button type="button" class="btn btn-ghost" disabled={confirming} onclick={onClose}>
					Fermer
				</button>
				<button
					type="button"
					class="btn gap-2 btn-primary"
					disabled={confirming}
					onclick={onConfirm}
				>
					{#if confirming}
						<span class="loading loading-sm loading-spinner"></span>
						Restauration…
					{:else}
						<Undo2 size={16} />
						Restaurer
					{/if}
				</button>
			</div>
		</div>
		<button
			type="button"
			class="modal-backdrop"
			aria-label="Fermer"
			disabled={confirming}
			onclick={onClose}
		></button>
	</div>
{/if}
