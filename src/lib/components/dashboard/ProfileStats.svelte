<script lang="ts">
	import type { ProfileStats } from '$lib/server/profile-stats';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CirclePlus from '@lucide/svelte/icons/circle-plus';
	import Clock from '@lucide/svelte/icons/clock';
	import SquarePen from '@lucide/svelte/icons/square-pen';

	interface Props {
		stats: ProfileStats;
	}

	let { stats }: Props = $props();

	const hasDirectActivity = $derived(stats.direct.gamesAdded > 0 || stats.direct.gamesEdited > 0);
	const hasSubmissions = $derived(stats.submissions.total > 0);
	const hasAnyStat = $derived(hasDirectActivity || hasSubmissions);
</script>

{#if hasAnyStat}
	<div class="flex flex-col gap-4">
		<h4 class="text-lg font-semibold text-base-content">Statistiques</h4>

		{#if hasDirectActivity}
			<div class="card border border-base-300 bg-base-100/95 shadow-sm">
				<div class="card-body gap-3 p-4">
					<p class="text-sm font-medium text-base-content/80">
						Contributions directes aux fiches jeux
					</p>
					<div class="stats stats-vertical w-full shadow-none lg:stats-horizontal">
						<div class="stat px-4 py-2">
							<div class="stat-figure text-primary">
								<CirclePlus class="h-6 w-6" />
							</div>
							<div class="stat-title">Jeux ajoutés</div>
							<div class="stat-value text-primary">{stats.direct.gamesAdded}</div>
							<div class="stat-desc">Mode direct ou gestion</div>
						</div>
						<div class="stat px-4 py-2">
							<div class="stat-figure text-secondary">
								<SquarePen class="h-6 w-6" />
							</div>
							<div class="stat-title">Jeux modifiés</div>
							<div class="stat-value text-secondary">{stats.direct.gamesEdited}</div>
							<div class="stat-desc">Mode direct ou gestion</div>
						</div>
					</div>
				</div>
			</div>
		{/if}

		{#if hasSubmissions}
			<div class="card border border-base-300 bg-base-100/95 shadow-sm">
				<div class="card-body gap-3 p-4">
					<p class="text-sm font-medium text-base-content/80">Soumissions</p>
					<div class="stats stats-vertical w-full shadow-none sm:stats-horizontal">
						<div class="stat px-4 py-2">
							<div class="stat-title">Total</div>
							<div class="stat-value text-lg">{stats.submissions.total}</div>
						</div>
						<div class="stat px-4 py-2">
							<div class="stat-figure text-warning">
								<Clock class="h-5 w-5" />
							</div>
							<div class="stat-title">En attente</div>
							<div class="stat-value text-warning">{stats.submissions.pending}</div>
						</div>
						<div class="stat px-4 py-2">
							<div class="stat-figure text-success">
								<CircleCheck class="h-5 w-5" />
							</div>
							<div class="stat-title">Acceptées</div>
							<div class="stat-value text-success">{stats.submissions.accepted}</div>
						</div>
					</div>
					{#if stats.submissions.accepted > 0}
						<ul class="mt-1 flex flex-wrap gap-2 text-sm">
							{#if stats.submissions.acceptedByType.game > 0}
								<li class="badge badge-outline">
									{stats.submissions.acceptedByType.game} jeu(x) créé(s)
								</li>
							{/if}
							{#if stats.submissions.acceptedByType.translation > 0}
								<li class="badge badge-outline">
									{stats.submissions.acceptedByType.translation} traduction(s) créée(s)
								</li>
							{/if}
							{#if stats.submissions.acceptedByType.update > 0}
								<li class="badge badge-outline">
									{stats.submissions.acceptedByType.update} mise(s) à jour
								</li>
							{/if}
							{#if stats.submissions.acceptedByType.delete > 0}
								<li class="badge badge-outline">
									{stats.submissions.acceptedByType.delete} suppression(s)
								</li>
							{/if}
							{#if stats.submissions.acceptedByType.translator_pages > 0}
								<li class="badge badge-outline">
									{stats.submissions.acceptedByType.translator_pages} page(s) traducteur
								</li>
							{/if}
						</ul>
					{/if}
				</div>
			</div>
		{/if}
	</div>
{/if}
