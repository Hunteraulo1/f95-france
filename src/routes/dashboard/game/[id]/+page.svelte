<script lang="ts">
	import { ArrowLeft, Calendar, ExternalLink, Gamepad2, Globe, Tag } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	
	const { game, translations } = data;

	const getStatusColor = (status: string) => {
		switch (status) {
			case 'completed': return 'badge-success';
			case 'in_progress': return 'badge-warning';
			case 'abandoned': return 'badge-error';
			default: return 'badge-neutral';
		}
	};

	const getStatusText = (status: string) => {
		switch (status) {
			case 'completed': return 'Terminé';
			case 'in_progress': return 'En cours';
			case 'abandoned': return 'Abandonné';
			default: return status;
		}
	};

	const getTtypeText = (ttype: string) => {
		switch (ttype) {
			case 'auto': return 'Automatique';
			case 'vf': return 'VO Française';
			case 'manual': return 'Manuelle';
			case 'semi-auto': return 'Semi-Automatique';
			case 'to_tested': return 'À tester';
			case 'hs': return 'Lien HS';
			default: return ttype;
		}
	};
</script>

<svelte:head>
	<title>{game.name} - F95 France</title>
	<meta name="description" content={game.description || `Détails du jeu ${game.name}`} />
</svelte:head>

<div class="min-h-screen bg-base-200">
	<div class="container mx-auto px-4 py-8">
		<!-- Bouton retour -->
		<div class="mb-6">
			<a href="/dashboard/manager" class="btn btn-ghost">
				<ArrowLeft size={20} />
				Retour à la recherche
			</a>
		</div>

		<!-- En-tête du jeu -->
		<div class="card bg-base-100 shadow-xl mb-8">
			<div class="card-body">
				<div class="flex flex-col lg:flex-row gap-6">
					<!-- Image du jeu -->
					<div class="flex-shrink-0">
						<img 
							src={game.image} 
							alt={game.name}
							class="w-48 h-64 object-cover rounded-lg shadow-md"
							loading="lazy"
						/>
					</div>
					
					<!-- Informations du jeu -->
					<div class="flex-1">
						<h1 class="text-3xl font-bold text-base-content mb-4">{game.name}</h1>
						
						{#if game.description}
							<p class="text-base-content/80 mb-4 leading-relaxed">{game.description}</p>
						{/if}

						<div class="flex flex-wrap gap-2 mb-4">
							<span class="badge badge-primary badge-lg">{game.type}</span>
							<span class="badge badge-secondary badge-lg">{game.website}</span>
							{#if game.threadId}
								<span class="badge badge-outline badge-lg">Thread #{game.threadId}</span>
							{/if}
						</div>

						{#if game.tags}
							<div class="mb-4">
								<div class="flex items-center gap-2 mb-2">
									<Tag size={16} />
									<span class="font-semibold">Tags</span>
								</div>
								<p class="text-sm text-base-content/70">{game.tags}</p>
							</div>
						{/if}

						{#if game.link}
							<div class="mb-4">
								<a 
									href={game.link} 
									target="_blank" 
									rel="noopener noreferrer"
									class="btn btn-outline btn-sm"
								>
									<ExternalLink size={16} />
									Lien du thread
								</a>
							</div>
						{/if}

						<div class="text-sm text-base-content/60">
							<div class="flex items-center gap-2 mb-1">
								<Calendar size={14} />
								<span>Créé le {new Date(game.createdAt).toLocaleDateString('fr-FR')}</span>
							</div>
							<div class="flex items-center gap-2">
								<Calendar size={14} />
								<span>Modifié le {new Date(game.updatedAt).toLocaleDateString('fr-FR')}</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Traductions -->
		{#if translations.length > 0}
			<div class="card bg-base-100 shadow-xl">
				<div class="card-body">
					<h2 class="text-2xl font-bold text-base-content mb-6 flex items-center gap-2">
						<Globe size={24} />
						Traductions ({translations.length})
					</h2>
					
					<div class="overflow-x-auto">
						<table class="table table-zebra w-full">
							<thead>
								<tr>
									<th>Version</th>
									<th>Version Trad</th>
									<th>Statut</th>
									<th>Type</th>
									<th>Actions</th>
								</tr>
							</thead>
							<tbody>
								{#each translations as translation}
									<tr>
										<td>
											<span class="badge badge-outline">{translation.version}</span>
										</td>
										<td>
											<span class="badge badge-outline">{translation.tversion}</span>
										</td>
										<td>
											<span class="badge {getStatusColor(translation.status)}">
												{getStatusText(translation.status)}
											</span>
										</td>
										<td>
											<span class="badge badge-info">
												{getTtypeText(translation.ttype)}
											</span>
										</td>
										<td>
											{#if translation.tlink}
												<a 
													href={translation.tlink} 
													target="_blank" 
													rel="noopener noreferrer"
													class="btn btn-ghost btn-sm"
												>
													<ExternalLink size={14} />
													Lien
												</a>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		{:else}
			<div class="card bg-base-100 shadow-xl">
				<div class="card-body text-center">
					<Gamepad2 size={48} class="mx-auto text-base-content/40 mb-4" />
					<h3 class="text-xl font-semibold text-base-content mb-2">Aucune traduction</h3>
					<p class="text-base-content/60">Ce jeu n'a pas encore de traduction disponible.</p>
				</div>
			</div>
		{/if}
	</div>
</div>
