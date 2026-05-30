<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Pagination from '$lib/components/Pagination.svelte';
	import RestoreHistoryModal from '$lib/components/dashboard/game/RestoreHistoryModal.svelte';
	import type { GameUpdateHistoryEntry } from '$lib/server/game-update-history-query';
	import { newToast } from '$lib/stores';
	import {
		formatUpdateHistoryDate,
		formatUpdateHistoryFieldValue,
		getUpdateHistoryActionBadgeClass,
		getUpdateHistoryActionLabel,
		getUpdateHistoryFieldLabel,
		resolveHistoryTranslationName,
		visibleHistoryDeltas
	} from '$lib/updates/update-history-display';
	import History from '@lucide/svelte/icons/history';
	import Undo2 from '@lucide/svelte/icons/undo-2';

	type TranslatorRow = { id: string; name: string };
	type TranslationRow = { id: string; translationName: string | null };

	let {
		gameId,
		canRevert = false,
		history,
		historyPage = 1,
		historyTotalPages = 1,
		historyTotalCount = 0,
		translators,
		translations
	}: {
		gameId: string;
		canRevert?: boolean;
		history: GameUpdateHistoryEntry[];
		historyPage?: number;
		historyTotalPages?: number;
		historyTotalCount?: number;
		translators: TranslatorRow[];
		translations: TranslationRow[];
	} = $props();

	const hrefForHistoryPage = (page: number) => {
		const base = resolve(`/dashboard/game/${gameId}`);
		if (page <= 1) return base;
		return `${base}?historyPage=${page}`;
	};

	let revertingId = $state<string | null>(null);
	let pendingRestoreEntry = $state<GameUpdateHistoryEntry | null>(null);

	const translatorLookup = $derived(translators.map((t) => ({ id: t.id, name: t.name })));
	const isConfirmingRestore = $derived(
		revertingId !== null && pendingRestoreEntry?.id === revertingId
	);

	function openRestoreModal(entry: GameUpdateHistoryEntry) {
		if (!canRevert || !entry.revertible || revertingId) return;
		pendingRestoreEntry = entry;
	}

	function closeRestoreModal() {
		if (revertingId) return;
		pendingRestoreEntry = null;
	}

	async function confirmRestore() {
		const entry = pendingRestoreEntry;
		if (!entry || revertingId) return;

		revertingId = entry.id;
		try {
			const response = await fetch(`/dashboard/game/${gameId}/update-history/${entry.id}`, {
				method: 'POST'
			});
			const body = (await response.json()) as { error?: string };
			if (!response.ok) {
				throw new Error(body.error ?? 'Impossible de restaurer cet état.');
			}

			newToast({ alertType: 'success', message: 'État restauré.' });
			pendingRestoreEntry = null;
			await invalidateAll();
		} catch (err) {
			newToast({
				alertType: 'error',
				message: err instanceof Error ? err.message : 'Impossible de restaurer cet état.'
			});
		} finally {
			revertingId = null;
		}
	}
</script>

<div class="card w-full border border-base-300 bg-base-100 shadow-xl">
	<div class="card-body gap-4 sm:p-8">
		<h2 class="flex items-center gap-2 text-2xl font-bold text-base-content">
			<History size={24} />
			Historique des traductions
		</h2>

		{#if history.length === 0}
			<p class="text-sm text-base-content/60">
				Aucun changement enregistré pour ce jeu pour le moment.
			</p>
		{:else}
			<ul class="timeline timeline-vertical timeline-compact w-full">
				{#each history as entry (entry.id)}
					{@const changes = entry.changes}
					{@const deltas = changes ? visibleHistoryDeltas(entry.action, changes.deltas) : []}
					<li>
						<div class="timeline-start w-28 pt-1 text-xs text-base-content/60">
							{formatUpdateHistoryDate(entry.createdAt)}
						</div>
						<div class="timeline-middle">
							<span
								class="status status-sm {entry.action === 'created'
									? 'status-success'
									: entry.action === 'deleted'
										? 'status-error'
										: 'status-info'}"
							></span>
						</div>
						<div
							class="timeline-end timeline-box mb-4 w-full max-w-none sm:max-w-[calc(100%-7rem)]"
						>
							<div class="mb-2 flex flex-wrap items-center gap-2">
								<span class="badge badge-sm {getUpdateHistoryActionBadgeClass(entry.action)}">
									{getUpdateHistoryActionLabel(entry.action)}
								</span>
								{#if changes}
									<span class="text-sm font-semibold text-base-content">
										{resolveHistoryTranslationName(
											changes.translationId,
											changes.deltas,
											translations
										)}
									</span>
								{/if}
								{#if canRevert && entry.revertible}
									<button
										type="button"
										class="btn btn-ghost btn-xs ml-auto gap-1"
										disabled={revertingId === entry.id}
										onclick={() => openRestoreModal(entry)}
										title={entry.revertCascadeCount > 1
											? `Restaure ${entry.revertCascadeCount} modification(s)`
											: 'Restaurer cet état'}
									>
										{#if revertingId === entry.id}
											<span class="loading loading-spinner loading-xs"></span>
										{:else}
											<Undo2 size={14} />
										{/if}
										Restaurer
									</button>
								{/if}
							</div>

							<p class="mb-2 text-xs text-base-content/60">
								{#if entry.username}
									Par
									<a
										class="link link-hover font-medium"
										href={`/dashboard/profile/${entry.username}`}
									>
										{entry.username}
									</a>
								{:else}
									Par le système
								{/if}
							</p>

							{#if deltas.length > 0}
								<ul class="space-y-1 text-sm">
									{#each deltas as delta (delta.field)}
										<li class="rounded-md bg-base-200/70 px-2 py-1">
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
							{/if}
						</div>
					</li>
				{/each}
			</ul>

			<div class="mt-2 border-t border-base-300 pt-4">
				<Pagination
					currentPage={historyPage}
					totalPages={historyTotalPages}
					totalCount={historyTotalCount}
					hrefForPage={hrefForHistoryPage}
					countLabel="entrée"
				/>
			</div>
		{/if}
	</div>
</div>

<RestoreHistoryModal
	entry={pendingRestoreEntry}
	{translators}
	{translations}
	confirming={isConfirmingRestore}
	onClose={closeRestoreModal}
	onConfirm={confirmRestore}
/>
