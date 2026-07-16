<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AutoCheckManualCard from '$lib/components/dashboard/AutoCheckManualCard.svelte';
	import {
		autoCheckIssueStageLabel,
		autoCheckStatusBadgeClass,
		autoCheckStatusLabel,
		autoCheckTriggerLabel
	} from '$lib/utils/auto-check-display';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
	import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
	import Clock3 from '@lucide/svelte/icons/clock-3';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';

	let { data } = $props();

	const formatDate = (value: Date | string | null | undefined) => {
		if (!value) return '—';
		return new Date(value).toLocaleString('fr-FR');
	};

	const formatDuration = (ms: number | null | undefined) => {
		if (ms == null) return '—';
		if (ms < 1000) return `${ms} ms`;
		return `${(ms / 1000).toFixed(1)} s`;
	};

	const selectRun = async (runId: string) => {
		await goto(resolve(`/dashboard/auto-check?run=${runId}`), {
			keepFocus: true,
			noScroll: true,
			invalidateAll: true
		});
	};

	const gameUpdates = $derived(data.items.filter((item) => item.kind === 'game_update'));
	const issues = $derived(data.items.filter((item) => item.kind === 'issue'));
	const selectedRun = $derived(data.runs.find((run) => run.id === data.selectedRunId) ?? null);
</script>

<svelte:head>
	<title>Suivi auto-check — Dashboard</title>
</svelte:head>

<div class="flex flex-col gap-6 p-4 sm:p-6">
	<div class="flex flex-wrap items-start justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold">Suivi auto-check</h1>
			<p class="mt-1 text-sm text-base-content/70">
				Historique des exécutions du cron de vérification des versions F95 (jeux et traductions
				suivis).
			</p>
		</div>
		<div class="flex flex-wrap gap-2">
			<button
				type="button"
				class="btn btn-ghost btn-sm"
				onclick={() => goto(resolve('/dashboard/auto-check'), { invalidateAll: true })}
			>
				<RefreshCw size={16} />
				Actualiser
			</button>
		</div>
	</div>

	<AutoCheckManualCard config={data.config} />

	{#if data.runs.length === 0}
		<div role="alert" class="alert">
			<Clock3 size={20} />
			<span
				>Aucun run enregistré pour le moment. Lancez un auto-check ou attendez le prochain cron.</span
			>
		</div>
	{:else}
		<div class="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]">
			<div class="card border border-base-300 bg-base-100 shadow-xl">
				<div class="card-body gap-3">
					<h2 class="card-title text-lg">Exécutions récentes</h2>
					<ul class="menu menu-sm rounded-box bg-base-200 p-1">
						{#each data.runs as run (run.id)}
							<li>
								<button
									type="button"
									class={run.id === data.selectedRunId ? 'menu-active' : ''}
									onclick={() => selectRun(run.id)}
								>
									<div class="flex w-full flex-col items-start gap-1">
										<div class="flex w-full flex-wrap items-center gap-2">
											<span class="font-medium">{formatDate(run.startedAt)}</span>
											<span class="badge badge-xs {autoCheckStatusBadgeClass(run.status)}">
												{autoCheckStatusLabel(run.status)}
											</span>
										</div>
										<span class="text-xs opacity-70">
											{autoCheckTriggerLabel(run.triggerSource)} · {run.updatedGames} maj ·
											{run.issueCount} alerte{run.issueCount > 1 ? 's' : ''}
										</span>
									</div>
								</button>
							</li>
						{/each}
					</ul>
				</div>
			</div>

			<div class="flex flex-col gap-4">
				{#if selectedRun}
					<div
						class="stats w-full stats-vertical border border-base-300 bg-base-100 shadow-xl sm:stats-horizontal"
					>
						<div class="stat">
							<div class="stat-title">Jeux scannés</div>
							<div class="stat-value text-primary">{selectedRun.scannedGames}</div>
						</div>
						<div class="stat">
							<div class="stat-title">Jeux mis à jour</div>
							<div class="stat-value text-secondary">{selectedRun.updatedGames}</div>
						</div>
						<div class="stat">
							<div class="stat-title">Traductions</div>
							<div class="stat-value text-accent">{selectedRun.updatedTranslations}</div>
						</div>
						<div class="stat">
							<div class="stat-title">Durée</div>
							<div class="stat-value text-lg">{formatDuration(selectedRun.durationMs)}</div>
						</div>
					</div>

					<div class="card border border-base-300 bg-base-100 shadow-xl">
						<div class="card-body gap-4">
							<div class="flex flex-wrap items-center gap-2">
								<span class="badge {autoCheckStatusBadgeClass(selectedRun.status)}">
									{autoCheckStatusLabel(selectedRun.status)}
								</span>
								<span class="badge badge-outline"
									>{autoCheckTriggerLabel(selectedRun.triggerSource)}</span
								>
								<span class="text-sm text-base-content/70">
									Début : {formatDate(selectedRun.startedAt)} · Fin :
									{formatDate(selectedRun.finishedAt)}
								</span>
							</div>

							{#if selectedRun.fatalError}
								<div role="alert" class="alert alert-error">
									<AlertTriangle size={18} />
									<span>{selectedRun.fatalError}</span>
								</div>
							{/if}

							<div class="grid gap-4 md:grid-cols-2">
								<div>
									<h3 class="mb-2 flex items-center gap-2 font-semibold">
										<CheckCircle2 size={18} class="text-success" />
										Mises à jour ({gameUpdates.length})
									</h3>
									{#if gameUpdates.length === 0}
										<p class="text-sm text-base-content/60">Aucun jeu mis à jour lors de ce run.</p>
									{:else}
										<ul class="space-y-2">
											{#each gameUpdates as item (item.id)}
												<li class="rounded-box border border-base-300 p-3 text-sm">
													<div class="flex flex-wrap items-center justify-between gap-2">
														{#if item.gameId}
															<a
																class="link font-medium link-hover"
																href={resolve(`/dashboard/manager/game/${item.gameId}`)}
															>
																{item.gameName ?? 'Jeu'}
															</a>
														{:else}
															<span class="font-medium">{item.gameName ?? 'Jeu'}</span>
														{/if}
														<span class="badge badge-outline badge-sm">
															{item.oldVersion ?? '—'} → {item.newVersion ?? '—'}
														</span>
													</div>
													{#if item.detail}
														<p class="mt-1 text-xs text-base-content/70">{item.detail}</p>
													{/if}
												</li>
											{/each}
										</ul>
									{/if}
								</div>

								<div>
									<h3 class="mb-2 flex items-center gap-2 font-semibold">
										<AlertTriangle size={18} class="text-warning" />
										Erreurs / alertes ({issues.length})
									</h3>
									{#if issues.length === 0}
										<p class="text-sm text-base-content/60">Aucune erreur signalée.</p>
									{:else}
										<ul class="space-y-2">
											{#each issues as item (item.id)}
												<li class="rounded-box border border-warning/30 bg-warning/5 p-3 text-sm">
													<div class="font-medium">
														{autoCheckIssueStageLabel(item.stage)}
													</div>
													<p>{item.message}</p>
													{#if item.gameName || item.gameId}
														<p class="mt-1 text-xs text-base-content/70">
															Jeu :
															{#if item.gameId}
																<a
																	class="link link-hover"
																	href={resolve(`/dashboard/manager/game/${item.gameId}`)}
																>
																	{item.gameName ?? item.gameId}
																</a>
															{:else}
																{item.gameName}
															{/if}
														</p>
													{/if}
													{#if item.detail}
														<p class="mt-1 text-xs whitespace-pre-wrap opacity-70">{item.detail}</p>
													{/if}
												</li>
											{/each}
										</ul>
									{/if}
								</div>
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<div class="text-sm text-base-content/60">
		Les utilisateurs avec la permission « Suivi auto-check » reçoivent une notification en cas
		d’erreur.
		<a class="inline-flex link items-center gap-1 link-hover" href={resolve('/dashboard/logs-app')}>
			Logs applicatifs
			<ArrowUpRight size={14} />
		</a>
	</div>
</div>
