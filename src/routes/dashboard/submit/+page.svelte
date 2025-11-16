<script lang="ts">
	import { CircleCheck, CircleX, Clock } from '@lucide/svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const getStatusBadge = (status: string) => {
		switch (status) {
			case 'pending':
				return { label: 'En attente', class: 'badge-warning', icon: Clock };
			case 'accepted':
				return { label: 'Acceptée', class: 'badge-success', icon: CircleCheck };
			case 'rejected':
				return { label: 'Refusée', class: 'badge-error', icon: CircleX };
			default:
				return { label: status, class: 'badge-neutral', icon: Clock };
		}
	};

	const getTypeLabel = (type: string) => {
		switch (type) {
			case 'game':
				return 'Jeu';
			case 'translation':
				return 'Traduction';
			case 'update':
				return 'Mise à jour';
			default:
				return type;
		}
	};
</script>

<section class="flex flex-col gap-4">
	<div class="flex items-center justify-between">
		<h2 class="text-lg font-semibold text-slate-900 dark:text-slate-200">
			Mes soumissions
			<span class="text-sm font-normal opacity-70">
				({data.submissions.length} soumission{data.submissions.length > 1 ? 's' : ''})
			</span>
		</h2>
	</div>

	{#if data.submissions.length === 0}
		<div class="card bg-base-100 shadow-sm p-8">
			<div class="text-center">
				<p class="text-lg opacity-70">Aucune soumission pour le moment</p>
			</div>
		</div>
	{:else}
		<div class="grid gap-4">
			{#each data.submissions as submission (submission.id)}
        {@const statusBadge = getStatusBadge(submission.status)}
        {@const StatusIcon = statusBadge.icon}
				<div class="card bg-base-100 shadow-sm">
					<div class="card-body">
						<div class="flex items-start justify-between gap-4">
							<div class="flex-1">
								<div class="flex items-center gap-3 mb-2">
									<h3 class="card-title text-lg">{submission.title}</h3>
									<div class="badge {statusBadge.class} gap-1">
										<StatusIcon size={14} />
										{statusBadge.label}
									</div>
									<div class="badge badge-outline">
										{getTypeLabel(submission.type)}
									</div>
								</div>
								
								{#if submission.description}
									<p class="text-sm opacity-70 mb-2 line-clamp-2">
										{submission.description}
									</p>
								{/if}

								{#if submission.game}
									<div class="flex items-center gap-2 mt-2">
										{#if submission.game.image}
											<img
												src={submission.game.image}
												alt={submission.game.name}
												class="w-10 h-10 rounded object-cover"
											/>
										{/if}
										<span class="text-sm opacity-70">{submission.game.name}</span>
									</div>
								{/if}

								<div class="text-xs opacity-50 mt-2">
									Créée le {new Date(submission.createdAt).toLocaleDateString('fr-FR', {
										year: 'numeric',
										month: 'long',
										day: 'numeric',
										hour: '2-digit',
										minute: '2-digit'
									})}
								</div>
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</section>
