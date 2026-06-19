<script lang="ts">
	import { browser } from '$app/environment';
	import DaisyDashboardModal from '$lib/components/dashboard/DaisyDashboardModal.svelte';
	import LogsModeNav from '$lib/components/dashboard/LogsModeNav.svelte';
	import { APP_LOG_LEVELS, appLogLevelsToParam, type AppLogLevel } from '$lib/logs/app-log';
	import type { LiveAppLogEntry } from '$lib/logs/live-app-log-entry';
	import Radio from '@lucide/svelte/icons/radio';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const LIVE_BUFFER = 80;

	let liveEnabled = $state(false);
	let liveStatus = $state<'off' | 'connecting' | 'on' | 'error'>('off');
	let liveLogs = $state<LiveAppLogEntry[]>([]);
	let liveSource: EventSource | null = null;
	let search = $state('');
	let sourceFilter = $state('');
	let limit = $state('50');
	let fromDate = $state('');
	let toDate = $state('');
	let levelDebug = $state(false);
	let levelInfo = $state(false);
	let levelWarn = $state(false);
	let levelError = $state(false);
	let showMetaModal = $state(false);
	let formattedMeta = $state<string | null>(null);
	let metaFormat = $state<'json' | 'texte'>('texte');
	let showMessageModal = $state(false);
	let messageDetail = $state<string | null>(null);
	let filtersInitialized = $state(false);

	$effect(() => {
		if (filtersInitialized) return;
		search = data.filters.search ?? '';
		sourceFilter = data.filters.source ?? '';
		limit = String(data.filters.limit);
		fromDate = data.filters.from ?? '';
		toDate = data.filters.to ?? '';
		const levels = new Set(data.filters.activeLevels);
		levelDebug = levels.has('debug');
		levelInfo = levels.has('info');
		levelWarn = levels.has('warn');
		levelError = levels.has('error');
		filtersInitialized = true;
	});

	const selectedLevels = $derived.by((): AppLogLevel[] => {
		const picked: AppLogLevel[] = [];
		if (levelDebug) picked.push('debug');
		if (levelInfo) picked.push('info');
		if (levelWarn) picked.push('warn');
		if (levelError) picked.push('error');
		return picked.length > 0 ? picked : [...APP_LOG_LEVELS];
	});

	const levelsHiddenValue = $derived(appLogLevelsToParam(selectedLevels));

	const formatDate = (value: string | Date) => {
		const date = value instanceof Date ? value : new Date(value);
		return new Intl.DateTimeFormat('fr-FR', {
			dateStyle: 'short',
			timeStyle: 'medium'
		}).format(date);
	};

	const levelBadge = (level: string) => {
		switch (level) {
			case 'debug':
				return 'badge-accent';
			case 'info':
				return 'badge-info';
			case 'warn':
				return 'badge-warning';
			case 'error':
				return 'badge-error';
			default:
				return 'badge-neutral';
		}
	};

	const openMetaModal = (meta: string) => {
		try {
			const parsed = JSON.parse(meta);
			formattedMeta = JSON.stringify(parsed, null, 2);
			metaFormat = 'json';
		} catch {
			formattedMeta = meta;
			metaFormat = 'texte';
		}
		showMetaModal = true;
	};

	const closeMetaModal = () => {
		showMetaModal = false;
		formattedMeta = null;
	};

	const openMessageModal = (message: string) => {
		messageDetail = message;
		showMessageModal = true;
	};

	const closeMessageModal = () => {
		showMessageModal = false;
		messageDetail = null;
	};

	const matchesLiveFilters = (entry: LiveAppLogEntry) => {
		if (!selectedLevels.includes(entry.level as AppLogLevel)) return false;
		if (sourceFilter && entry.source !== sourceFilter) return false;
		const q = search.trim().toLowerCase();
		if (q) {
			const haystack = [entry.message, entry.source, entry.meta ?? ''].join(' ').toLowerCase();
			if (!haystack.includes(q)) return false;
		}
		if (fromDate) {
			const fromMs = Date.parse(`${fromDate}T00:00:00.000Z`);
			const createdMs = Date.parse(entry.createdAt);
			if (!Number.isNaN(fromMs) && !Number.isNaN(createdMs) && createdMs < fromMs) return false;
		}
		if (toDate) {
			const toStartMs = Date.parse(`${toDate}T00:00:00.000Z`);
			const toExclusiveMs = toStartMs + 86_400_000;
			const createdMs = Date.parse(entry.createdAt);
			if (!Number.isNaN(toStartMs) && !Number.isNaN(createdMs) && createdMs >= toExclusiveMs) {
				return false;
			}
		}
		return true;
	};

	const displayedLogs = $derived.by(() => {
		const liveIds = new Set(liveLogs.map((entry) => entry.id));
		return [
			...liveLogs.filter(matchesLiveFilters),
			...data.logs.filter((log) => !liveIds.has(log.id))
		];
	});

	const bufferedLiveCount = $derived.by(() => {
		const existingIds = new Set(data.logs.map((log) => log.id));
		return liveLogs.filter((entry) => matchesLiveFilters(entry) && !existingIds.has(entry.id))
			.length;
	});

	const totalCount = $derived(data.pagination.totalCount + bufferedLiveCount);

	const levelCounts = $derived.by(() =>
		displayedLogs.reduce(
			(acc, log) => {
				const key = log.level as AppLogLevel;
				if (key in acc) acc[key] += 1;
				return acc;
			},
			{ debug: 0, info: 0, warn: 0, error: 0 } satisfies Record<AppLogLevel, number>
		)
	);

	const disconnectLive = () => {
		if (liveSource) {
			liveSource.close();
			liveSource = null;
		}
		if (!liveEnabled) liveStatus = 'off';
	};

	const connectLive = () => {
		if (!browser || liveSource) return;
		liveStatus = 'connecting';

		const source = new EventSource('/api/logs-app/live');
		liveSource = source;

		source.addEventListener('connected', () => {
			liveStatus = 'on';
		});

		source.addEventListener('log', (event) => {
			try {
				const payload = JSON.parse(event.data) as { entry: LiveAppLogEntry };
				liveStatus = 'on';
				liveLogs = [payload.entry, ...liveLogs.filter((e) => e.id !== payload.entry.id)].slice(
					0,
					LIVE_BUFFER
				);
			} catch {
				// ignore
			}
		});

		source.onerror = () => {
			if (!liveEnabled) {
				liveStatus = 'off';
				return;
			}
			liveStatus = source.readyState === EventSource.CONNECTING ? 'connecting' : 'error';
		};
	};

	const toggleLive = () => {
		liveEnabled = !liveEnabled;
		if (liveEnabled) {
			connectLive();
		} else {
			disconnectLive();
			liveStatus = 'off';
		}
	};

	onMount(() => () => {
		liveEnabled = false;
		disconnectLive();
	});

	const buildPageHref = (targetPage: number) => {
		const pairs: Array<[string, string]> = [];
		if (data.filters.search) pairs.push(['q', data.filters.search]);
		if (data.filters.source) pairs.push(['source', data.filters.source]);
		pairs.push(['levels', appLogLevelsToParam(data.filters.activeLevels)]);
		if (data.filters.from) pairs.push(['from', data.filters.from]);
		if (data.filters.to) pairs.push(['to', data.filters.to]);
		pairs.push(['limit', String(data.pagination.limit)]);
		pairs.push(['page', String(targetPage)]);
		const query = pairs
			.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
			.join('&');
		return `/dashboard/logs-app?${query}`;
	};
</script>

<svelte:head>
	<title>Logs applicatif - Tableau de bord</title>
</svelte:head>

<div class="space-y-6">
	<LogsModeNav
		mode="app"
		activeLevels={data.filters.activeLevels}
		preserve={{
			search: data.filters.search,
			source: data.filters.source,
			limit: data.pagination.limit,
			page: data.pagination.page
		}}
	/>

	<div class="flex flex-wrap items-center justify-between gap-4">
		<div>
			<h1 class="text-3xl font-bold text-base-content">Logs applicatif</h1>
			<p class="text-base-content/70">
				Cron, workers, files d’attente et événements serveur (hors journal HTTP).
			</p>
			{#if liveEnabled && liveStatus === 'on'}
				<p class="mt-1 text-sm text-success">Mode Live — nouveaux logs en temps réel</p>
			{:else if liveEnabled && liveStatus === 'connecting'}
				<p class="mt-1 text-sm text-base-content/60">Connexion au flux live…</p>
			{:else if liveEnabled && liveStatus === 'error'}
				<p class="mt-1 text-sm text-warning">Flux interrompu — reconnexion automatique en cours…</p>
			{/if}
		</div>
		<button
			type="button"
			class="btn btn-sm gap-2 {liveEnabled ? 'btn-success' : 'btn-outline'}"
			aria-pressed={liveEnabled}
			title="Afficher les nouveaux logs en temps réel"
			onclick={toggleLive}
		>
			<Radio class="size-4 {liveEnabled && liveStatus === 'on' ? 'animate-pulse' : ''}" />
			Live
		</button>
	</div>

	<div
		class="stats stats-vertical w-full border border-base-300 bg-base-100 shadow-sm sm:stats-horizontal"
	>
		<div class="stat">
			<div class="stat-title">Total</div>
			<div class="stat-value text-base-content">{totalCount}</div>
			<div class="stat-desc">
				Page {data.pagination.page} / {data.pagination.totalPages}
			</div>
		</div>
		<div class="stat">
			<div class="stat-title">Debug</div>
			<div class="stat-value text-accent">{levelCounts.debug}</div>
		</div>
		<div class="stat">
			<div class="stat-title">Info</div>
			<div class="stat-value text-info">{levelCounts.info}</div>
		</div>
		<div class="stat">
			<div class="stat-title">Warn</div>
			<div class="stat-value text-warning">{levelCounts.warn}</div>
		</div>
		<div class="stat">
			<div class="stat-title">Error</div>
			<div class="stat-value text-error">{levelCounts.error}</div>
		</div>
	</div>

	<form method="GET" class="card w-full border border-base-300 bg-base-100 shadow-xl">
		<div class="card-body gap-6 sm:p-8">
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
				<label class="form-control flex flex-col">
					<span class="label-text">Source</span>
					<select class="select-bordered select" name="source" bind:value={sourceFilter}>
						<option value="">Toutes</option>
						{#each data.sourceOptions as option (option)}
							<option value={option}>{option}</option>
						{/each}
					</select>
				</label>
				<label class="form-control flex flex-col">
					<span class="label-text"
						>Recherche <span class="text-sm">(message, source ou meta)</span></span
					>
					<input
						type="text"
						name="q"
						class="input-bordered input"
						placeholder="cron, worker, queue…"
						bind:value={search}
					/>
				</label>
				<label class="form-control flex flex-col">
					<span class="label-text">Du</span>
					<input type="date" name="from" class="input-bordered input" bind:value={fromDate} />
				</label>
				<label class="form-control flex flex-col">
					<span class="label-text">Au</span>
					<input type="date" name="to" class="input-bordered input" bind:value={toDate} />
				</label>
				<label class="form-control flex flex-col">
					<span class="label-text">Limite</span>
					<select class="select-bordered select" name="limit" bind:value={limit}>
						{#each [25, 50, 100, 200, 500] as option (option)}
							<option value={option}>{option} lignes</option>
						{/each}
					</select>
				</label>
			</div>

			<div class="rounded-box border border-base-300 bg-base-200/30 p-4">
				<label class="form-control flex flex-col">
					<span class="label-text mb-2">Filtres de niveau</span>
					<div class="flex flex-wrap gap-3">
						<label class="label cursor-pointer">
							<input type="checkbox" class="checkbox checkbox-accent" bind:checked={levelDebug} />
							<span class="label-text">Debug</span>
						</label>
						<label class="label cursor-pointer">
							<input type="checkbox" class="checkbox checkbox-info" bind:checked={levelInfo} />
							<span class="label-text">Info</span>
						</label>
						<label class="label cursor-pointer">
							<input type="checkbox" class="checkbox checkbox-warning" bind:checked={levelWarn} />
							<span class="label-text">Warn</span>
						</label>
						<label class="label cursor-pointer">
							<input type="checkbox" class="checkbox checkbox-error" bind:checked={levelError} />
							<span class="label-text">Error</span>
						</label>
					</div>
					<input type="hidden" name="levels" value={levelsHiddenValue} />
				</label>
			</div>

			<div class="flex flex-wrap items-center justify-between gap-3 border-t border-base-300 pt-4">
				<p class="text-sm text-base-content/70">
					Affichage : {displayedLogs.length} ligne{displayedLogs.length > 1 ? 's' : ''}
					{#if liveEnabled && liveLogs.length > 0}
						· {liveLogs.length} en direct
					{:else if !liveEnabled && liveLogs.length > 0}
						· {liveLogs.length} en session
					{/if}
					· {totalCount} au total
				</p>
				<div class="flex gap-2">
					<a href="/dashboard/logs-app" class="btn btn-ghost">Réinitialiser</a>
					<button type="submit" class="btn btn-primary">Actualiser</button>
				</div>
			</div>
		</div>
	</form>

	<div class="card w-full border border-base-300 bg-base-100 shadow-xl">
		<div class="card-body gap-6 sm:py-8">
			<div class="overflow-x-auto">
				<table class="table table-zebra">
					<thead>
						<tr>
							<th>Date</th>
							<th>Niveau</th>
							<th>Source</th>
							<th class="max-w-sm">Message</th>
							<th>Meta</th>
						</tr>
					</thead>
					<tbody>
						{#if displayedLogs.length === 0}
							<tr>
								<td colspan="5" class="py-10 text-center text-base-content/60">
									Aucun log disponible pour ces critères.
								</td>
							</tr>
						{:else}
							{#each displayedLogs as log (log.id)}
								<tr>
									<td class="whitespace-nowrap">{formatDate(log.createdAt)}</td>
									<td>
										<span class={`badge ${levelBadge(log.level)}`}>{log.level}</span>
									</td>
									<td class="max-w-xs">
										<span class="badge badge-outline font-mono text-xs" title={log.source}
											>{log.source}</span
										>
									</td>
									<td class="max-w-sm">
										{#if log.message.length > 120}
											<button
												type="button"
												class="block max-w-sm truncate text-left font-mono text-sm hover:text-primary"
												title={log.message}
												onclick={() => openMessageModal(log.message)}
											>
												{log.message}
											</button>
										{:else}
											<span class="block truncate font-mono text-sm" title={log.message}
												>{log.message}</span
											>
										{/if}
									</td>
									<td class="max-w-xs">
										{#if log.meta}
											<button
												type="button"
												class="btn text-primary btn-ghost btn-xs"
												onclick={() => openMetaModal(log.meta ?? '')}
											>
												Voir
											</button>
										{:else}
											<span class="text-base-content/60">—</span>
										{/if}
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	</div>

	<div class="flex items-center justify-center">
		<div class="join">
			{#if data.pagination.page > 1}
				<a class="join-item btn" href={buildPageHref(data.pagination.page - 1)}>Précédent</a>
			{:else}
				<button class="join-item btn btn-disabled" type="button">Précédent</button>
			{/if}
			<button class="join-item btn btn-active" type="button">
				Page {data.pagination.page} / {data.pagination.totalPages}
			</button>
			{#if data.pagination.page < data.pagination.totalPages}
				<a class="join-item btn" href={buildPageHref(data.pagination.page + 1)}>Suivant</a>
			{:else}
				<button class="join-item btn btn-disabled" type="button">Suivant</button>
			{/if}
		</div>
	</div>
</div>

<DaisyDashboardModal
	open={showMetaModal && formattedMeta !== null}
	title="Meta de l’événement"
	description="Contexte JSON ou texte associé au log."
	maxWidthClass="max-w-4xl"
	scrollBody={true}
	onClose={closeMetaModal}
>
	{#if formattedMeta}
		<span class={`badge ${metaFormat === 'json' ? 'badge-success' : 'badge-neutral'}`}>
			{metaFormat === 'json' ? 'JSON' : 'Texte'}
		</span>
		<pre class="mt-4 max-h-[60vh] overflow-auto rounded-lg bg-base-200 p-4 text-left text-xs">
{formattedMeta}
</pre>
	{/if}
	{#snippet footer()}
		<button type="button" class="btn btn-primary" onclick={closeMetaModal}>Fermer</button>
	{/snippet}
</DaisyDashboardModal>

<DaisyDashboardModal
	open={showMessageModal && messageDetail !== null}
	title="Message complet"
	description="Contenu intégral du log applicatif."
	maxWidthClass="max-w-4xl"
	scrollBody={true}
	onClose={closeMessageModal}
>
	{#if messageDetail}
		<pre
			class="max-h-[60vh] overflow-auto rounded-lg bg-base-200 p-4 text-left text-xs whitespace-pre-wrap font-mono">
{messageDetail}
</pre>
	{/if}
	{#snippet footer()}
		<button type="button" class="btn btn-primary" onclick={closeMessageModal}>Fermer</button>
	{/snippet}
</DaisyDashboardModal>
