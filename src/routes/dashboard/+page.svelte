<script lang="ts">
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CirclePlus from '@lucide/svelte/icons/circle-plus';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import Clock from '@lucide/svelte/icons/clock';
	import Gamepad2 from '@lucide/svelte/icons/gamepad-2';
	import Inbox from '@lucide/svelte/icons/inbox';
	import Languages from '@lucide/svelte/icons/languages';
	import Pencil from '@lucide/svelte/icons/pencil';
	import TrendingUp from '@lucide/svelte/icons/trending-up';
	import UserCheck from '@lucide/svelte/icons/user-check';
	import Users from '@lucide/svelte/icons/users';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="space-y-6">
	<h1 class="text-3xl font-bold text-base-content">Tableau de bord</h1>

	{#if data.userStats}
		<!-- Statistiques personnelles -->
		<div class="mb-8">
			<h2 class="mb-4 text-xl font-semibold text-base-content">Mes statistiques</h2>
			<div class="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
				<!-- Mes soumissions -->
				<div class="card col-span-1 bg-base-200 shadow-xl">
					<div class="card-body rounded-lg border border-base-300 bg-base-100">
						<div class="flex items-center justify-between">
							<div>
								<a
									href="/dashboard/submit"
									class="card-title link text-base-content link-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
								>
									Mes soumissions
								</a>
								<p class="text-3xl font-bold text-primary">{data.userStats.totalSubmissions}</p>
							</div>
							<Inbox class="h-12 w-12 text-primary" />
						</div>
						<div class="mt-4 flex gap-4 text-sm">
							<a
								href="/dashboard/submit?status=pending"
								class="flex link items-center gap-2 text-base-content/70 link-hover"
							>
								<Clock class="h-4 w-4 text-warning" />
								<span>{data.userStats.pendingSubmissions} en attente</span>
							</a>
							<a
								href="/dashboard/submit?status=accepted"
								class="flex link items-center gap-2 text-base-content/70 link-hover"
							>
								<CircleCheck class="h-4 w-4 text-success" />
								<span>{data.userStats.acceptedSubmissions} acceptées</span>
							</a>
						</div>
					</div>
				</div>

				<!-- Mes traductions -->
				<div class="card bg-base-200 shadow-xl">
					<div class="card-body rounded-lg border border-base-300 bg-base-100">
						<div class="flex items-center justify-between">
							<div>
								<a
									href="/dashboard/my-translations"
									class="card-title link text-base-content link-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
								>
									Mes traductions
								</a>
								<p class="text-3xl font-bold text-primary">{data.userStats.translations.total}</p>
							</div>
							<Languages class="h-12 w-12 text-primary" />
						</div>
						<div class="mt-4 flex flex-wrap gap-4 text-sm">
							<a
								href="/dashboard/my-translations"
								class="flex link items-center gap-2 text-base-content/70 link-hover"
							>
								<CircleCheck class="h-4 w-4 text-success" />
								<span>{data.userStats.translations.upToDate} à jour</span>
							</a>
							<a
								href="/dashboard/my-translations"
								class="flex link items-center gap-2 text-base-content/70 link-hover"
							>
								<CircleX class="h-4 w-4 text-warning" />
								<span>{data.userStats.translations.outdated} pas à jour</span>
							</a>
						</div>
					</div>
				</div>

				<!-- Traductions ajoutées / modifiées -->
				<div class="card bg-base-200 shadow-xl">
					<div class="card-body rounded-lg border border-base-300 bg-base-100">
						<div class="flex items-center justify-between">
							<div>
								<a
									href="/dashboard/submit?status=accepted"
									class="card-title link text-base-content link-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
								>
									Mes actions traduction
								</a>
								<p class="text-3xl font-bold text-primary">
									{data.userStats.gameAdd + data.userStats.gameEdit}
								</p>
							</div>
							<Languages class="h-12 w-12 text-primary" />
						</div>
						<div class="mt-4 flex flex-wrap gap-4 text-sm">
							<a
								href="/dashboard/submit?status=accepted"
								class="flex link items-center gap-2 text-base-content/70 link-hover"
							>
								<CirclePlus class="h-4 w-4 text-success" />
								<span>{data.userStats.gameAdd} ajoutées</span>
							</a>
							<a
								href="/dashboard/submit?status=accepted"
								class="flex link items-center gap-2 text-base-content/70 link-hover"
							>
								<Pencil class="h-4 w-4 text-info" />
								<span>{data.userStats.gameEdit} modifiées</span>
							</a>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}

	{#if data.canReviewSubmissions && data.stats}
		<!-- Statistiques administrateur -->
		<div>
			<h2 class="mb-4 text-xl font-semibold text-base-content">Statistiques générales</h2>

			<!-- Cartes principales -->
			<div class="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
				<!-- Total jeux -->
				<a
					href="/dashboard/manager"
					class="card bg-base-200 shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
				>
					<div class="card-body rounded-lg bg-base-100">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="card-title text-sm text-base-content">Total jeux</h3>
								<p class="text-3xl font-bold text-primary">{data.stats.totalGames}</p>
							</div>
							<Gamepad2 class="h-10 w-10 text-primary" />
						</div>
					</div>
				</a>

				<!-- Total traductions -->
				<a
					href="/dashboard/manager"
					class="card bg-base-200 shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
				>
					<div class="card-body rounded-lg border border-base-300 bg-base-100">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="card-title text-sm text-base-content">Total traductions</h3>
								<p class="text-3xl font-bold text-primary">{data.stats.translations.total}</p>
							</div>
							<Languages class="h-10 w-10 text-primary" />
						</div>
					</div>
				</a>

				<!-- Total utilisateurs -->
				<a
					href="/dashboard/users"
					class="card bg-base-200 shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
				>
					<div class="card-body rounded-lg border border-base-300 bg-base-100">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="card-title text-sm text-base-content">Total utilisateurs</h3>
								<p class="text-3xl font-bold text-primary">{data.stats.totalUsers}</p>
							</div>
							<Users class="h-10 w-10 text-primary" />
						</div>
					</div>
				</a>

				<!-- Total traducteurs -->
				<a
					href="/dashboard/translators"
					class="card bg-base-200 shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
				>
					<div class="card-body rounded-lg border border-base-300 bg-base-100">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="card-title text-sm text-base-content">Traducteurs</h3>
								<p class="text-3xl font-bold text-primary">{data.stats.totalTranslators}</p>
							</div>
							<UserCheck class="h-10 w-10 text-primary" />
						</div>
					</div>
				</a>
			</div>

			<!-- Détails des traductions -->
			<div class="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
				<a
					href="/dashboard/manager"
					class="card bg-base-200 shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
				>
					<div class="card-body rounded-lg border border-base-300 bg-base-100">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="card-title text-sm text-base-content">Traductions en cours</h3>
								<p class="text-2xl font-bold text-warning">{data.stats.translations.inProgress}</p>
							</div>
							<Clock class="h-8 w-8 text-warning" />
						</div>
					</div>
				</a>

				<a
					href="/dashboard/manager"
					class="card bg-base-200 shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
				>
					<div class="card-body rounded-lg border border-base-300 bg-base-100">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="card-title text-sm text-base-content">Traductions terminées</h3>
								<p class="text-2xl font-bold text-success">{data.stats.translations.completed}</p>
							</div>
							<CircleCheck class="h-8 w-8 text-success" />
						</div>
					</div>
				</a>

				<a
					href="/dashboard/manager"
					class="card bg-base-200 shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
				>
					<div class="card bg-base-200 shadow-xl">
						<div class="card-body rounded-lg border border-base-300 bg-base-100">
							<div class="flex items-center justify-between">
								<div>
									<h3 class="card-title text-sm text-base-content">Traductions abandonnées</h3>
									<p class="text-2xl font-bold text-error">{data.stats.translations.abandoned}</p>
								</div>
								<CircleX class="h-8 w-8 text-error" />
							</div>
						</div>
					</div>
				</a>

				<a href="/dashboard/submits?status=pending">
					<div class="card bg-base-200 shadow-xl">
						<div class="card-body rounded-lg border border-base-300 bg-base-100">
							<div class="flex items-center justify-between">
								<div>
									<h3 class="card-title text-sm text-base-content">Soumissions en attente</h3>
									<p class="text-2xl font-bold text-warning">
										{data.stats.submissions.pending +
											data.stats.submissions.opened +
											data.stats.submissions.toFix}
									</p>
								</div>
								<Clock class="h-8 w-8 text-warning" />
							</div>
						</div>
					</div>
				</a>
				<a href="/dashboard/submits?status=accepted">
					<div class="card bg-base-200 shadow-xl">
						<div class="card-body rounded-lg border border-base-300 bg-base-100">
							<div class="flex items-center justify-between">
								<div>
									<h3 class="card-title text-sm text-base-content">Soumissions acceptées</h3>
									<p class="text-2xl font-bold text-success">{data.stats.submissions.accepted}</p>
								</div>
								<CircleCheck class="h-8 w-8 text-success" />
							</div>
						</div>
					</div>
				</a>
				<a href="/dashboard/submits?status=rejected">
					<div class="card bg-base-200 shadow-xl">
						<div class="card-body rounded-lg border border-base-300 bg-base-100">
							<div class="flex items-center justify-between">
								<div>
									<h3 class="card-title text-sm text-base-content">Soumissions rejetées</h3>
									<p class="text-2xl font-bold text-error">{data.stats.submissions.rejected}</p>
								</div>
								<CircleX class="h-8 w-8 text-error" />
							</div>
						</div>
					</div>
				</a>
			</div>

			<!-- Activité récente (7 derniers jours) -->
			<div>
				<h3 class="mb-4 flex items-center gap-2 text-lg font-semibold text-base-content">
					<TrendingUp class="h-5 w-5" />
					Activité récente (7 derniers jours)
				</h3>
				<div class="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
					<a
						href="/dashboard/manager"
						class="card bg-base-200 shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
					>
						<div class="card-body rounded-lg border border-base-300 bg-base-100">
							<div class="flex items-center justify-between">
								<div>
									<h3 class="card-title text-sm text-base-content">Nouveaux jeux</h3>
									<p class="text-2xl font-bold text-primary">{data.stats.recent.games}</p>
								</div>
								<Gamepad2 class="h-8 w-8 text-primary" />
							</div>
						</div>
					</a>

					<a
						href="/dashboard/manager"
						class="card bg-base-200 shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
					>
						<div class="card-body rounded-lg border border-base-300 bg-base-100">
							<div class="flex items-center justify-between">
								<div>
									<h3 class="card-title text-sm text-base-content">Traductions mises à jour</h3>
									<p class="text-2xl font-bold text-primary">{data.stats.recent.translations}</p>
								</div>
								<Languages class="h-8 w-8 text-primary" />
							</div>
						</div>
					</a>

					<a
						href="/dashboard/users"
						class="card bg-base-200 shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
					>
						<div class="card-body rounded-lg border border-base-300 bg-base-100">
							<div class="flex items-center justify-between">
								<div>
									<h3 class="card-title text-sm text-base-content">Nouveaux utilisateurs</h3>
									<p class="text-2xl font-bold text-primary">{data.stats.recent.users}</p>
								</div>
								<Users class="h-8 w-8 text-primary" />
							</div>
						</div>
					</a>
				</div>
			</div>
		</div>
	{/if}
</div>
