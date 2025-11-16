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
			<h2 class="text-xl font-semibold text-base-content mb-4">Mes statistiques</h2>
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				<!-- Mes soumissions -->
				<div class="card bg-base-200 shadow-xl">
					<div class="card-body">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="card-title text-base-content">Mes soumissions</h3>
								<p class="text-3xl font-bold text-primary">{data.userStats.totalSubmissions}</p>
							</div>
							<Inbox class="w-12 h-12 text-primary" />
						</div>
						<div class="flex gap-4 mt-4 text-sm">
							<div class="flex items-center gap-2">
								<Clock class="w-4 h-4 text-warning" />
								<span class="text-base-content/70">{data.userStats.pendingSubmissions} en attente</span>
							</div>
							<div class="flex items-center gap-2">
								<CircleCheck class="w-4 h-4 text-success" />
								<span class="text-base-content/70">{data.userStats.acceptedSubmissions} acceptées</span>
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
							<CirclePlus class="w-12 h-12 text-primary" />
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
							<Pencil class="w-12 h-12 text-primary" />
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}

	{#if data.isAdmin && data.stats}
		<!-- Statistiques administrateur -->
		<div>
			<h2 class="text-xl font-semibold text-base-content mb-4">Statistiques générales</h2>
			
			<!-- Cartes principales -->
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
				<!-- Total jeux -->
				<div class="card bg-base-200 shadow-xl">
					<div class="card-body">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="card-title text-base-content text-sm">Total jeux</h3>
								<p class="text-3xl font-bold text-primary">{data.stats.totalGames}</p>
							</div>
							<Gamepad2 class="w-10 h-10 text-primary" />
						</div>
					</div>
				</div>

				<!-- Total traductions -->
				<div class="card bg-base-200 shadow-xl">
					<div class="card-body">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="card-title text-base-content text-sm">Total traductions</h3>
								<p class="text-3xl font-bold text-primary">{data.stats.translations.total}</p>
							</div>
							<Languages class="w-10 h-10 text-primary" />
						</div>
					</div>
				</div>

				<!-- Total utilisateurs -->
				<div class="card bg-base-200 shadow-xl">
					<div class="card-body">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="card-title text-base-content text-sm">Total utilisateurs</h3>
								<p class="text-3xl font-bold text-primary">{data.stats.totalUsers}</p>
							</div>
							<Users class="w-10 h-10 text-primary" />
						</div>
					</div>
				</div>

				<!-- Total traducteurs -->
				<div class="card bg-base-200 shadow-xl">
					<div class="card-body">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="card-title text-base-content text-sm">Traducteurs</h3>
								<p class="text-3xl font-bold text-primary">{data.stats.totalTranslators}</p>
							</div>
							<UserCheck class="w-10 h-10 text-primary" />
						</div>
					</div>
				</div>
			</div>

			<!-- Détails des traductions -->
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
				<div class="card bg-base-200 shadow-xl">
					<div class="card-body">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="card-title text-base-content text-sm">Traductions en cours</h3>
								<p class="text-2xl font-bold text-warning">{data.stats.translations.inProgress}</p>
							</div>
							<Clock class="w-8 h-8 text-warning" />
						</div>
					</div>
				</div>

				<div class="card bg-base-200 shadow-xl">
					<div class="card-body">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="card-title text-base-content text-sm">Traductions complétées</h3>
								<p class="text-2xl font-bold text-success">{data.stats.translations.completed}</p>
							</div>
							<CircleCheck class="w-8 h-8 text-success" />
						</div>
					</div>
				</div>

				<div class="card bg-base-200 shadow-xl">
					<div class="card-body">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="card-title text-base-content text-sm">Traductions abandonnées</h3>
								<p class="text-2xl font-bold text-error">{data.stats.translations.abandoned}</p>
							</div>
							<CircleX class="w-8 h-8 text-error" />
						</div>
					</div>
				</div>
			</div>

			<!-- Détails des soumissions -->
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
				<div class="card bg-base-200 shadow-xl">
					<div class="card-body">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="card-title text-base-content text-sm">Soumissions en attente</h3>
								<p class="text-2xl font-bold text-warning">{data.stats.submissions.pending}</p>
							</div>
							<Clock class="w-8 h-8 text-warning" />
						</div>
					</div>
				</div>

				<div class="card bg-base-200 shadow-xl">
					<div class="card-body">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="card-title text-base-content text-sm">Soumissions acceptées</h3>
								<p class="text-2xl font-bold text-success">{data.stats.submissions.accepted}</p>
							</div>
							<CircleCheck class="w-8 h-8 text-success" />
						</div>
					</div>
				</div>

				<div class="card bg-base-200 shadow-xl">
					<div class="card-body">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="card-title text-base-content text-sm">Soumissions rejetées</h3>
								<p class="text-2xl font-bold text-error">{data.stats.submissions.rejected}</p>
							</div>
							<CircleX class="w-8 h-8 text-error" />
						</div>
					</div>
				</div>
			</div>

			<!-- Activité récente (7 derniers jours) -->
			<div>
				<h3 class="text-lg font-semibold text-base-content mb-4 flex items-center gap-2">
					<TrendingUp class="w-5 h-5" />
					Activité récente (7 derniers jours)
				</h3>
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div class="card bg-base-200 shadow-xl">
						<div class="card-body">
							<div class="flex items-center justify-between">
								<div>
									<h3 class="card-title text-base-content text-sm">Nouveaux jeux</h3>
									<p class="text-2xl font-bold text-primary">{data.stats.recent.games}</p>
								</div>
								<Gamepad2 class="w-8 h-8 text-primary" />
							</div>
						</div>
					</div>

					<div class="card bg-base-200 shadow-xl">
						<div class="card-body">
							<div class="flex items-center justify-between">
								<div>
									<h3 class="card-title text-base-content text-sm">Traductions mises à jour</h3>
									<p class="text-2xl font-bold text-primary">{data.stats.recent.translations}</p>
								</div>
								<Languages class="w-8 h-8 text-primary" />
							</div>
						</div>
					</div>

					<div class="card bg-base-200 shadow-xl">
						<div class="card-body">
							<div class="flex items-center justify-between">
								<div>
									<h3 class="card-title text-base-content text-sm">Nouveaux utilisateurs</h3>
									<p class="text-2xl font-bold text-primary">{data.stats.recent.users}</p>
								</div>
								<Users class="w-8 h-8 text-primary" />
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
