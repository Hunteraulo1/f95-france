<script lang="ts">
	import type { GameUpdateHistoryEntry } from '$lib/server/game-update-history-query';
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

	type TranslatorRow = { id: string; name: string };
	type TranslationRow = { id: string; translationName: string | null };

	let {
		history,
		translators,
		translations
	}: {
		history: GameUpdateHistoryEntry[];
		translators: TranslatorRow[];
		translations: TranslationRow[];
	} = $props();

	const translatorLookup = $derived(translators.map((t) => ({ id: t.id, name: t.name })));
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
		{/if}
	</div>
</div>
