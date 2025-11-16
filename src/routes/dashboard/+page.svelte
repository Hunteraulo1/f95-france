<script lang="ts">
	import {
		CircleCheck,
		CirclePlus,
		CircleX,
		Clock,
		Gamepad2,
		Inbox,
		Languages,
		Pencil,
		TrendingUp,
		UserCheck,
		Users
	} from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="space-y-6">
	<h1 class="text-3xl font-bold text-base-content">Tableau de bord</h1>

	{#if data.userStats}
		<!-- Statistiques personnelles -->
		<div class="mb-8">
			<h2 class="mb-4 text-xl font-semibold text-base-content">Mes statistiques</h2>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
				<!-- Mes soumissions -->
				<div class="card bg-base-200 shadow-xl">
					<div class="card-body">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="card-title text-base-content">Mes soumissions</h3>
								<p class="text-3xl font-bold text-primary">{data.userStats.totalSubmissions}</p>
							</div>
							<Inbox class="h-12 w-12 text-primary" />
						</div>
						<div class="mt-4 flex gap-4 text-sm">
							<div class="flex items-center gap-2">
								<Clock class="h-4 w-4 text-warning" />
								<span class="text-base-content/70"
									>{data.userStats.pendingSubmissions} en attente</span
								>
							</div>
							<div class="flex items-center gap-2">
								<CircleCheck class="h-4 w-4 text-success" />
								<span class="text-base-content/70"
									>{data.userStats.acceptedSubmissions} acceptées</span
								>
							</div>
						</div>
					</div>
				</div>

				<!-- Jeux ajoutés -->
				<div class="card bg-base-200 shadow-xl">
					<div class="card-body">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="card-title text-base-content">Jeux ajoutés</h3>
								<p class="text-3xl font-bold text-primary">{data.userStats.gameAdd}</p>
							</div>
							<CirclePlus class="h-12 w-12 text-primary" />
						</div>
					</div>
				</div>

				<!-- Jeux modifiés -->
				<div class="card bg-base-200 shadow-xl">
					<div class="card-body">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="card-title text-base-content">Jeux modifiés</h3>
								<p class="text-3xl font-bold text-primary">{data.userStats.gameEdit}</p>
							</div>
							<Pencil class="h-12 w-12 text-primary" />
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}

	{#if data.isAdmin && data.stats}
		<!-- Statistiques administrateur -->
		<div>
			<h2 class="mb-4 text-xl font-semibold text-base-content">Statistiques générales</h2>

			<!-- Cartes principales -->
			<div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
				<!-- Total jeux -->
				<div class="card bg-base-200 shadow-xl">
					<div class="card-body">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="card-title text-sm text-base-content">Total jeux</h3>
								<p class="text-3xl font-bold text-primary">{data.stats.totalGames}</p>
							</div>
							<Gamepad2 class="h-10 w-10 text-primary" />
						</div>
					</div>
				</div>

				<!-- Total traductions -->
				<div class="card bg-base-200 shadow-xl">
					<div class="card-body">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="card-title text-sm text-base-content">Total traductions</h3>
								<p class="text-3xl font-bold text-primary">{data.stats.translations.total}</p>
							</div>
							<Languages class="h-10 w-10 text-primary" />
						</div>
					</div>
				</div>

				<!-- Total utilisateurs -->
				<div class="card bg-base-200 shadow-xl">
					<div class="card-body">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="card-title text-sm text-base-content">Total utilisateurs</h3>
								<p class="text-3xl font-bold text-primary">{data.stats.totalUsers}</p>
							</div>
							<Users class="h-10 w-10 text-primary" />
						</div>
					</div>
				</div>

				<!-- Total traducteurs -->
				<div class="card bg-base-200 shadow-xl">
					<div class="card-body">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="card-title text-sm text-base-content">Traducteurs</h3>
								<p class="text-3xl font-bold text-primary">{data.stats.totalTranslators}</p>
							</div>
							<UserCheck class="h-10 w-10 text-primary" />
						</div>
					</div>
				</div>
			</div>

			<!-- Détails des traductions -->
			<div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
				<div class="card bg-base-200 shadow-xl">
					<div class="card-body">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="card-title text-sm text-base-content">Traductions en cours</h3>
								<p class="text-2xl font-bold text-warning">{data.stats.translations.inProgress}</p>
							</div>
							<Clock class="h-8 w-8 text-warning" />
						</div>
					</div>
				</div>

				<div class="card bg-base-200 shadow-xl">
					<div class="card-body">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="card-title text-sm text-base-content">Traductions complétées</h3>
								<p class="text-2xl font-bold text-success">{data.stats.translations.completed}</p>
							</div>
							<CircleCheck class="h-8 w-8 text-success" />
						</div>
					</div>
				</div>

				<div class="card bg-base-200 shadow-xl">
					<div class="card-body">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="card-title text-sm text-base-content">Traductions abandonnées</h3>
								<p class="text-2xl font-bold text-error">{data.stats.translations.abandoned}</p>
							</div>
							<CircleX class="h-8 w-8 text-error" />
						</div>
					</div>
				</div>
			</div>

			<!-- Détails des soumissions -->
			<div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
				<div class="card bg-base-200 shadow-xl">
					<div class="card-body">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="card-title text-sm text-base-content">Soumissions en attente</h3>
								<p class="text-2xl font-bold text-warning">{data.stats.submissions.pending}</p>
							</div>
							<Clock class="h-8 w-8 text-warning" />
						</div>
					</div>
				</div>

				<div class="card bg-base-200 shadow-xl">
					<div class="card-body">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="card-title text-sm text-base-content">Soumissions acceptées</h3>
								<p class="text-2xl font-bold text-success">{data.stats.submissions.accepted}</p>
							</div>
							<CircleCheck class="h-8 w-8 text-success" />
						</div>
					</div>
				</div>

				<div class="card bg-base-200 shadow-xl">
					<div class="card-body">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="card-title text-sm text-base-content">Soumissions rejetées</h3>
								<p class="text-2xl font-bold text-error">{data.stats.submissions.rejected}</p>
							</div>
							<CircleX class="h-8 w-8 text-error" />
						</div>
					</div>
				</div>
			</div>

			<!-- Activité récente (7 derniers jours) -->
			<div>
				<h3 class="mb-4 flex items-center gap-2 text-lg font-semibold text-base-content">
					<TrendingUp class="h-5 w-5" />
					Activité récente (7 derniers jours)
				</h3>
				<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
					<div class="card bg-base-200 shadow-xl">
						<div class="card-body">
							<div class="flex items-center justify-between">
								<div>
									<h3 class="card-title text-sm text-base-content">Nouveaux jeux</h3>
									<p class="text-2xl font-bold text-primary">{data.stats.recent.games}</p>
								</div>
								<Gamepad2 class="h-8 w-8 text-primary" />
							</div>
						</div>
					</div>

					<div class="card bg-base-200 shadow-xl">
						<div class="card-body">
							<div class="flex items-center justify-between">
								<div>
									<h3 class="card-title text-sm text-base-content">Traductions mises à jour</h3>
									<p class="text-2xl font-bold text-primary">{data.stats.recent.translations}</p>
								</div>
								<Languages class="h-8 w-8 text-primary" />
							</div>
						</div>
					</div>

					<div class="card bg-base-200 shadow-xl">
						<div class="card-body">
							<div class="flex items-center justify-between">
								<div>
									<h3 class="card-title text-sm text-base-content">Nouveaux utilisateurs</h3>
									<p class="text-2xl font-bold text-primary">{data.stats.recent.users}</p>
								</div>
								<Users class="h-8 w-8 text-primary" />
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
