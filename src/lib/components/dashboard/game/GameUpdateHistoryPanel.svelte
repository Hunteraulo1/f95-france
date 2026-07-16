<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import RestoreHistoryModal from '$lib/components/dashboard/game/RestoreHistoryModal.svelte';
	import InfiniteScrollSentinel from '$lib/components/InfiniteScrollSentinel.svelte';
	import { useInfiniteList } from '$lib/infinite-scroll/use-infinite-list.svelte';
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
	import type { GameUpdateHistoryEntry } from '$lib/updates/update-history-types';
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

	const list = useInfiniteList<GameUpdateHistoryEntry>({
		getInitial: () => ({
			items: history ?? [],
			page: historyPage ?? 1,
			totalPages: historyTotalPages ?? 1
		}),
		getCacheKey: () => gameId,
		buildUrl: (nextPage) =>
			`${resolve(`/dashboard/manager/game/${gameId}/update-history`)}?page=${nextPage}`,
		pickItems: (body) =>
			Array.isArray(body.entries) ? (body.entries as GameUpdateHistoryEntry[]) : []
	});

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
			const response = await fetch(`/dashboard/manager/game/${gameId}/update-history/${entry.id}`, {
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
			{#if historyTotalCount > 0}
				<span class="badge badge-sm font-normal badge-neutral">{historyTotalCount}</span>
			{/if}
		</h2>

		{#if list.items.length === 0}
			<p class="text-sm text-base-content/60">
				Aucun changement enregistré pour ce jeu pour le moment.
			</p>
		{:else}
			<ul class="timeline timeline-vertical timeline-compact w-full">
				{#each list.items as entry (entry.id)}
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
							class="timeline-end mb-4 w-full max-w-none timeline-box sm:max-w-[calc(100%-7rem)]"
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
										class="btn ml-auto gap-1 btn-ghost btn-xs"
										disabled={revertingId === entry.id}
										onclick={() => openRestoreModal(entry)}
										title={entry.revertCascadeCount > 1
											? `Restaure ${entry.revertCascadeCount} modification(s)`
											: 'Restaurer cet état'}
									>
										{#if revertingId === entry.id}
											<span class="loading loading-xs loading-spinner"></span>
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
										class="link font-medium link-hover"
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
				<InfiniteScrollSentinel
					hasMore={list.hasMore}
					loading={list.loadingMore}
					error={list.loadMoreError}
					onLoadMore={list.loadMore}
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
