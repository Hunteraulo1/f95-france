<script lang="ts">
	import { newToast } from '$lib/stores';
	import type { FormGameType } from '$lib/types';
	import {
		ArrowLeft,
		CalendarCheck2,
		CalendarClock,
		ExternalLink,
		Gamepad2,
		Globe,
		Plus,
		RefreshCcw,
		Square,
		SquareCheckBig,
		SquarePen,
		Tag,
		Trash2
	} from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const { game, translations, user: currentUser } = data;
	const canRefreshGame = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';

	// État pour le modal d'ajout de traduction
	let showAddTranslationModal = $state(false);
	let newTranslation = $state({
		translationName: '',
		version: '',
		tversion: '',
		status: 'in_progress',
		ttype: 'manual',
		tlink: '',
		ac: false
	});

	// État pour le modal de modification de traduction
	let showEditTranslationModal = $state(false);
	let editingTranslation = $state({
		translationName: '',
		id: '',
		version: '',
		tversion: '',
		status: 'in_progress',
		ttype: 'manual',
		tlink: '',
		ac: false
	});

	// État pour la suppression
	let translationToDelete = $state<(typeof translations)[number] | null>(null);
	let gameToDelete = $state<boolean>(false);

	// État pour le modal de modification du jeu
	let showEditGameModal = $state(false);
	let editingGame = $state({
		name: '',
		description: '',
		type: '',
		website: '',
		threadId: '',
		tags: '',
		link: '',
		image: ''
	});

	const getStatusColor = (status: string) => {
		switch (status) {
			case 'completed':
				return 'badge-success';
			case 'in_progress':
				return 'badge-warning';
			case 'abandoned':
				return 'badge-error';
			default:
				return 'badge-neutral';
		}
	};

	const getStatusText = (status: string) => {
		switch (status) {
			case 'completed':
				return 'Terminé';
			case 'in_progress':
				return 'En cours';
			case 'abandoned':
				return 'Abandonné';
			default:
				return status;
		}
	};

	const getTtypeText = (ttype: string) => {
		switch (ttype) {
			case 'auto':
				return 'Automatique';
			case 'vf':
				return 'VO Française';
			case 'manual':
				return 'Manuelle';
			case 'semi-auto':
				return 'Semi-Automatique';
			case 'to_tested':
				return 'À tester';
			case 'hs':
				return 'Lien HS';
			default:
				return ttype;
		}
	};

	const openAddTranslationModal = () => {
		showAddTranslationModal = true;
	};

	const closeAddTranslationModal = () => {
		showAddTranslationModal = false;
		newTranslation = {
			translationName: '',
			version: '',
			tversion: '',
			status: 'in_progress',
			ttype: 'manual',
			tlink: '',
			ac: false
		};
	};

	const refreshGame = async () => {
		if (!game.threadId || game.website === 'other') {
			newToast({
				alertType: 'warning',
				message: "Ce jeu n'est pas lié à un thread compatible."
			});
			return;
		}

		const autoTranslation = translations.find((translation) => translation.ac);

		if (!autoTranslation) {
			newToast({
				alertType: 'warning',
				message: 'Ajoutez une traduction Auto-Check pour utiliser le rafraîchissement.'
			});
			return;
		}

		try {
			const response = await fetch('/dashboard/manager/scrape', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ threadId: game.threadId, website: game.website })
			});

			const payload = await response.json();

			if (!response.ok || !payload.success) {
				throw new Error(payload.error ?? 'Erreur lors du rafraîchissement');
			}

			const data = payload.data as {
				name: string | null;
				version: string | null;
				status: string | null;
				tags: string | null;
				type: FormGameType['type'] | null;
				image: string | null;
			};

			if (!data.version) {
				newToast({
					alertType: 'warning',
					message: 'Version introuvable sur le thread, rafraîchissement annulé.'
				});
				return;
			}

			showEditGameModal = true;
			editingGame = {
				...editingGame,
				name: data.name ?? game.name,
				tags: data.tags ?? game.tags,
				type: data.type ?? game.type,
				image: data.image ?? game.image
			};

			const translationResponse = await fetch(
				`/dashboard/game/${game.id}/translations/${autoTranslation.id}`,
				{
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						translationName: autoTranslation.translationName,
						version: data.version,
						tversion: autoTranslation.tversion,
						status: autoTranslation.status,
						ttype: autoTranslation.ttype,
						tlink: autoTranslation.tlink ?? '',
						ac: autoTranslation.ac ?? false,
						directMode: true
					})
				}
			);

			if (!translationResponse.ok) {
				const details = await translationResponse.json().catch(() => ({}));
				throw new Error(details.error || 'Erreur lors de la mise à jour de la traduction');
			}

			newToast({
				alertType: 'success',
				message: 'Jeu et traduction Auto-Check rafraîchis'
			});

			window.location.reload();
		} catch (error) {
			console.error('Erreur lors du rafraîchissement du jeu:', error);
			newToast({
				alertType: 'error',
				message: "Impossible d'actualiser ce jeu"
			});
		}
	};

	const addTranslation = async () => {
		try {
			const response = await fetch(`/dashboard/game/${game.id}/translations`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(newTranslation)
			});

			if (response.ok) {
				// Recharger la page pour voir la nouvelle traduction
				window.location.reload();
			} else {
				console.error("Erreur lors de l'ajout de la traduction");
			}
		} catch (error) {
			console.error("Erreur lors de l'ajout de la traduction:", error);
		}
	};

	const openEditTranslationModal = (translation: (typeof translations)[number]) => {
		editingTranslation = {
			translationName: translation.translationName || '',
			id: translation.id,
			version: translation.version,
			tversion: translation.tversion,
			status: translation.status,
			ttype: translation.ttype,
			tlink: translation.tlink,
			ac: translation.ac ?? false
		};
		showEditTranslationModal = true;
	};

	const closeEditTranslationModal = () => {
		showEditTranslationModal = false;
		editingTranslation = {
			translationName: '',
			id: '',
			version: '',
			tversion: '',
			status: 'in_progress',
			ttype: 'manual',
			tlink: '',
			ac: false
		};
	};

	const editTranslation = async () => {
		try {
			const response = await fetch(
				`/dashboard/game/${game.id}/translations/${editingTranslation.id}`,
				{
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(editingTranslation)
				}
			);

			if (response.ok) {
				// Recharger la page pour voir les modifications
				window.location.reload();
			} else {
				console.error('Erreur lors de la modification de la traduction');
			}
		} catch (error) {
			console.error('Erreur lors de la modification de la traduction:', error);
		}
	};

	const confirmDeleteTranslation = (translation: (typeof translations)[number]) => {
		translationToDelete = translation;
	};

	const cancelDeleteTranslation = () => {
		translationToDelete = null;
	};

	const deleteTranslation = async () => {
		if (!translationToDelete) return;

		try {
			const response = await fetch(
				`/dashboard/game/${game.id}/translations/${translationToDelete.id}`,
				{
					method: 'DELETE'
				}
			);

			if (response.ok) {
				// Recharger la page pour voir les modifications
				window.location.reload();
			} else {
				console.error('Erreur lors de la suppression de la traduction');
			}
		} catch (error) {
			console.error('Erreur lors de la suppression de la traduction:', error);
		}
	};

	const confirmDeleteGame = () => {
		gameToDelete = true;
	};

	const cancelDeleteGame = () => {
		gameToDelete = false;
	};

	const deleteGame = async () => {
		try {
			const response = await fetch(`/dashboard/game/${game.id}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				// Rediriger vers la liste des jeux après suppression
				window.location.href = '/dashboard/manager';
			} else {
				const data = await response.json();
				console.error('Erreur lors de la suppression du jeu:', data.error || 'Erreur inconnue');
				alert('Erreur lors de la suppression du jeu: ' + (data.error || 'Erreur inconnue'));
			}
		} catch (error) {
			console.error('Erreur lors de la suppression du jeu:', error);
			alert('Erreur lors de la suppression du jeu');
		}
	};

	const openEditGameModal = () => {
		console.log('openEditGameModal called');
		editingGame = {
			name: game.name,
			description: game.description || '',
			type: game.type,
			website: game.website,
			threadId: game.threadId ? String(game.threadId) : '',
			tags: game.tags || '',
			link: game.link || '',
			image: game.image
		};
		showEditGameModal = true;
		console.log('showEditGameModal set to:', showEditGameModal);
	};

	const closeEditGameModal = () => {
		showEditGameModal = false;
		editingGame = {
			name: '',
			description: '',
			type: '',
			website: '',
			threadId: '',
			tags: '',
			link: '',
			image: ''
		};
	};

	const editGame = async () => {
		try {
			const response = await fetch(`/dashboard/game/${game.id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(editingGame)
			});

			if (response.ok) {
				// Fermer le modal
				closeEditGameModal();
				// Recharger la page pour voir les modifications
				window.location.reload();
			} else {
				const errorData = await response.json();
				alert(`Erreur lors de la modification du jeu: ${errorData.error || 'Erreur inconnue'}`);
			}
		} catch (error) {
			console.error('Erreur lors de la modification du jeu:', error);
			alert('Erreur de connexion lors de la modification du jeu');
		}
	};
</script>

<svelte:head>
	<title>{game.name} - F95 France</title>
	<meta name="description" content={game.description || `Détails du jeu ${game.name}`} />
</svelte:head>

<div class="min-h-screen bg-base-200">
	<div class="container mx-auto">
		<!-- Bouton retour -->
		<div class="absolute -mt-13">
			<a href="/dashboard/manager" class="btn btn-ghost">
				<ArrowLeft size={20} />
				Retour à la recherche
			</a>
		</div>

		<!-- En-tête du jeu -->
		<div class="card mb-8 bg-base-100 shadow-xl">
			<div class="card-body">
				<div class="flex flex-col gap-6 lg:flex-row">
					<!-- Image du jeu -->
					<div class="flex shrink-0 flex-col gap-4">
						<img
							src={game.image}
							alt={game.name}
							class="h-64 w-48 rounded-lg object-cover shadow-md"
							loading="lazy"
						/>
						<button class="btn btn-sm btn-primary" onclick={openEditGameModal}>
							<SquarePen size={16} />
							Modifier le jeu
						</button>
						{#if canRefreshGame}
							<button class="btn btn-sm btn-secondary" onclick={refreshGame}>
								<RefreshCcw size={16} />
								Actualiser le jeu
							</button>
						{/if}
						<button class="btn btn-sm btn-error" onclick={confirmDeleteGame}>
							<Trash2 size={16} />
							Supprimer le jeu
						</button>
					</div>

					<!-- Informations du jeu -->
					<div class="flex-1">
						<h1 class="mb-4 text-3xl font-bold text-base-content">{game.name}</h1>

						{#if game.description}
							<p class="mb-4 leading-relaxed text-base-content/80">{game.description}</p>
						{/if}

						<div class="mb-4 flex flex-wrap gap-2">
							<span class="badge badge-lg badge-primary">{game.type}</span>
							<span class="badge badge-lg badge-secondary">{game.website}</span>
							{#if game.threadId}
								<span class="badge badge-outline badge-lg">Thread #{game.threadId}</span>
							{/if}
						</div>

						{#if game.tags}
							<div class="mb-4">
								<div class="mb-2 flex items-center gap-2">
									<Tag size={16} />
									<span class="font-semibold">Tags</span>
								</div>
								<p class="text-sm text-base-content/70">{game.tags}</p>
							</div>
						{/if}

						<div class="mb-4 flex gap-2">
							{#if game.link}
								<a
									href={game.link}
									target="_blank"
									rel="noopener noreferrer"
									class="btn btn-outline btn-sm"
								>
									<ExternalLink size={16} />
									Lien du thread
								</a>
							{/if}
						</div>

						<div class="text-sm text-base-content/60">
							<div class="mb-1 flex items-center gap-2">
								<CalendarCheck2 size={14} />
								<span>Créé le {new Date(game.createdAt).toLocaleDateString('fr-FR')}</span>
							</div>
							<div class="flex items-center gap-2">
								<CalendarClock size={14} />
								<span>Modifié le {new Date(game.updatedAt).toLocaleDateString('fr-FR')}</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		{#if translations.length > 0}
			<div class="card bg-base-100 text-nowrap shadow-xl">
				<div class="card-body">
					<div class="mb-6 flex items-center justify-between">
						<h2 class="flex items-center gap-2 text-2xl font-bold text-base-content">
							<Globe size={24} />
							Traductions ({translations.length})
						</h2>
						<button class="btn btn-sm btn-primary" onclick={openAddTranslationModal}>
							<Plus size={16} />
							Ajouter une traduction
						</button>
					</div>

					<div class="overflow-x-auto">
						<table class="table w-full table-zebra">
							<thead>
								<tr>
									<th>Nom de la traduction</th>
									<th>Version</th>
									<th>Version Trad</th>
									<th>Statut</th>
									<th>Type</th>
									<th>Auto-Check</th>
									<th>Lien de traduction</th>
									<th>Actions</th>
								</tr>
							</thead>
							<tbody>
								{#each translations as translation (translation.id)}
									<tr>
										<td class="font-bold">
											{translation.translationName}
										</td>
										<td class="font-bold">{translation.version}</td>
										<td class="font-bold">{translation.tversion}</td>
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
											{#if translation.ac}
												<SquareCheckBig size={14} />
											{:else}
												<Square size={14} />
											{/if}
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
										<td>
											<button
												class="btn btn-sm btn-primary"
												onclick={() => openEditTranslationModal(translation)}>Modifier</button
											>
											<button
												class="btn btn-sm btn-error"
												onclick={() => confirmDeleteTranslation(translation)}>Supprimer</button
											>
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
					<Gamepad2 size={48} class="mx-auto mb-4 text-base-content/40" />
					<h3 class="mb-2 text-xl font-semibold text-base-content">Aucune traduction</h3>
					<p class="mb-4 text-base-content/60">Ce jeu n'a pas encore de traduction disponible.</p>
					<button class="btn btn-primary" onclick={openAddTranslationModal}>
						<Plus size={16} />
						Ajouter une traduction
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Modal d'ajout de traduction -->
{#if showAddTranslationModal}
	<div class="modal-open modal">
		<div class="modal-box">
			<h3 class="mb-4 text-lg font-bold">Ajouter une traduction</h3>

			<div class="form-control mb-4 w-full">
				<label class="input" for="translationName">
					Nom de la traduction
					<input
						id="translationName"
						type="text"
						placeholder="Ex: Traduction française"
						class="w-full input-ghost"
						bind:value={newTranslation.translationName}
						required
					/>
				</label>
			</div>

			<div class="form-control mb-4 w-full">
				<label class="input" for="version">
					Version du jeu
					<input
						id="version"
						type="text"
						placeholder="Ex: 1.0.0"
						class="w-full input-ghost"
						bind:value={newTranslation.version}
						required
					/>
				</label>
			</div>

			<div class="form-control mb-4 w-full">
				<label class="input" for="tversion">
					Version de traduction
					<input
						id="tversion"
						type="text"
						placeholder="Ex: 1.0"
						class="w-full input-ghost"
						bind:value={newTranslation.tversion}
						required
					/>
				</label>
			</div>

			<div class="form-control mb-4 w-full">
				<label class="input pr-0" for="status">
					Statut
					<select
						id="status"
						class="w-full select-ghost"
						bind:value={newTranslation.status}
						required
					>
						<option value="in_progress">En cours</option>
						<option value="completed">Terminé</option>
						<option value="abandoned">Abandonné</option>
					</select>
				</label>
			</div>

			<div class="form-control mb-4 w-full">
				<label class="input pr-0" for="ttype">
					Type de traduction
					<select id="ttype" class="w-full select-ghost" bind:value={newTranslation.ttype} required>
						<option value="manual">Manuelle</option>
						<option value="auto">Automatique</option>
						<option value="semi-auto">Semi-Automatique</option>
						<option value="vf">VO Française</option>
						<option value="to_tested">À tester</option>
						<option value="hs">Lien HS</option>
					</select>
				</label>
			</div>

			<div class="form-control mb-6 w-full">
				<label class="input" for="tlink">
					Lien de traduction
					<input
						id="tlink"
						type="url"
						placeholder="https://..."
						class="w-full input-ghost"
						bind:value={newTranslation.tlink}
						required
					/>
				</label>
			</div>

			<div class="modal-action">
				<button class="btn btn-ghost" onclick={closeAddTranslationModal}>Annuler</button>
				<button class="btn btn-primary" onclick={addTranslation}>Ajouter</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal de modification de traduction -->
{#if showEditTranslationModal}
	<div class="modal-open modal">
		<div class="modal-box">
			<h3 class="mb-4 text-lg font-bold">Modifier la traduction</h3>

			<div class="form-control mb-4 w-full">
				<label class="input" for="edit-translationName">
					Nom de la traduction
					<input
						id="edit-translationName"
						type="text"
						placeholder="Ex: Traduction française"
						class="w-full input-ghost"
						bind:value={editingTranslation.translationName}
						required
					/>
				</label>
			</div>

			<div class="form-control mb-4 w-full">
				<label class="input" for="edit-version">
					Version du jeu
					<input
						id="edit-version"
						type="text"
						placeholder="Ex: 1.0.0"
						class="w-full input-ghost"
						bind:value={editingTranslation.version}
						required
					/>
				</label>
			</div>

			<div class="form-control mb-4 w-full">
				<label class="input" for="edit-tversion">
					Version de traduction
					<input
						id="edit-tversion"
						type="text"
						placeholder="Ex: 1.0"
						class="w-full input-ghost"
						bind:value={editingTranslation.tversion}
						required
					/>
				</label>
			</div>

			<div class="form-control mb-4 w-full">
				<label class="input pr-0" for="edit-status">
					Statut
					<select
						id="edit-status"
						class="w-full select-ghost"
						bind:value={editingTranslation.status}
						required
					>
						<option value="in_progress">En cours</option>
						<option value="completed">Terminé</option>
						<option value="abandoned">Abandonné</option>
					</select>
				</label>
			</div>

			<div class="form-control mb-4 w-full">
				<label class="input pr-0" for="edit-ttype">
					Type de traduction
					<select
						id="edit-ttype"
						class="w-full select-ghost"
						bind:value={editingTranslation.ttype}
						required
					>
						<option value="manual">Manuelle</option>
						<option value="auto">Automatique</option>
						<option value="semi-auto">Semi-Automatique</option>
						<option value="vf">VO Française</option>
						<option value="to_tested">À tester</option>
						<option value="hs">Lien HS</option>
					</select>
				</label>
			</div>

			<div class="form-control mb-6 w-full">
				<label class="input" for="edit-tlink">
					Lien de traduction
					<input
						id="edit-tlink"
						type="url"
						placeholder="https://..."
						class="w-full input-ghost"
						bind:value={editingTranslation.tlink}
						required
					/>
				</label>
			</div>

			{#if canRefreshGame}
				<div class="form-control mb-6 w-full">
					<label class="label cursor-pointer" for="edit-ac">
						<span class="label-text">Auto-Check</span>
						<input
							id="edit-ac"
							type="checkbox"
							class="toggle"
							bind:checked={editingTranslation.ac}
						/>
					</label>
					<p class="mt-1 text-xs text-base-content/60">
						Activez cette option pour que la traduction soit automatiquement rafraîchie lors d'un
						scrape.
					</p>
				</div>
			{/if}

			<div class="modal-action">
				<button class="btn btn-ghost" onclick={closeEditTranslationModal}>Annuler</button>
				<button class="btn btn-primary" onclick={editTranslation}>Modifier</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal de modification du jeu -->
{#if showEditGameModal}
	<div class="modal-open modal">
		<div class="modal-box max-w-2xl">
			<h3 class="mb-4 text-lg font-bold">Modifier le jeu</h3>

			<div class="grid grid-cols-2 gap-4">
				<div class="form-control w-full">
					<label class="input" for="edit-game-name">
						Nom du jeu
						<input
							id="edit-game-name"
							type="text"
							placeholder="Nom du jeu"
							class="w-full input-ghost"
							bind:value={editingGame.name}
							required
						/>
					</label>
				</div>
				<div class="form-control w-full">
					<label class="input" for="edit-game-type">
						Type
						<input
							id="edit-game-type"
							type="text"
							placeholder="Ex: Visual Novel"
							class="w-full input-ghost"
							bind:value={editingGame.type}
							required
						/>
					</label>
				</div>
				<div class="form-control w-full">
					<label class="input" for="edit-game-website">
						Site web
						<input
							id="edit-game-website"
							type="text"
							placeholder="Ex: F95Zone"
							class="w-full input-ghost"
							bind:value={editingGame.website}
							required
						/>
					</label>
				</div>
				<div class="form-control w-full">
					<label class="input" for="edit-game-threadId">
						ID du thread
						<input
							id="edit-game-threadId"
							type="text"
							placeholder="Ex: 12345"
							class="w-full input-ghost"
							bind:value={editingGame.threadId}
						/>
					</label>
				</div>
				<div class="form-control w-full">
					<label class="input" for="edit-game-link">
						Lien du thread
						<input
							id="edit-game-link"
							type="url"
							placeholder="https://..."
							class="w-full input-ghost"
							bind:value={editingGame.link}
						/>
					</label>
				</div>
				<div class="form-control w-full">
					<label class="input" for="edit-game-image">
						URL de l'image
						<input
							id="edit-game-image"
							type="url"
							placeholder="https://..."
							class="w-full input-ghost"
							bind:value={editingGame.image}
							required
						/>
					</label>
				</div>
				<div class="form-control w-full">
					<label for="edit-game-tags"> Tags </label>
					<textarea
						id="edit-game-tags"
						placeholder="Ex: 3D, Adventure, Romance"
						class="textarea h-full w-full"
						bind:value={editingGame.tags}
					></textarea>
				</div>
				<div class="form-control w-full">
					<label for="edit-game-description"> Description </label>
					<textarea
						id="edit-game-description"
						placeholder="Description du jeu"
						class="textarea h-full w-full"
						bind:value={editingGame.description}
					></textarea>
				</div>
			</div>

			<div class="modal-action">
				<button class="btn btn-ghost" onclick={closeEditGameModal}>Annuler</button>
				<button class="btn btn-primary" onclick={editGame}>Modifier</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal de confirmation de suppression de traduction -->
{#if translationToDelete}
	<div class="modal-open modal">
		<div class="modal-box">
			<h3 class="mb-4 text-lg font-bold">Confirmer la suppression</h3>
			<p class="mb-6">Êtes-vous sûr de vouloir supprimer cette traduction ?</p>
			<div class="mb-6 rounded-lg bg-base-200 p-4">
				<p><strong>Version:</strong> {translationToDelete.version}</p>
				<p><strong>Version Trad:</strong> {translationToDelete.tversion}</p>
				<p><strong>Statut:</strong> {getStatusText(translationToDelete.status)}</p>
			</div>
			<div class="modal-action">
				<button class="btn btn-ghost" onclick={cancelDeleteTranslation}>Annuler</button>
				<button class="btn btn-error" onclick={deleteTranslation}>Supprimer</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal de confirmation de suppression de jeu -->
{#if gameToDelete}
	<div class="modal-open modal">
		<div class="modal-box">
			<h3 class="mb-4 text-lg font-bold">Confirmer la suppression</h3>
			<p class="mb-6">Êtes-vous sûr de vouloir supprimer ce jeu ?</p>
			<div class="mb-6 rounded-lg bg-base-200 p-4">
				<p><strong>Nom:</strong> {game.name}</p>
				<p class="mt-2 text-error">
					<strong>Attention:</strong> Cette action supprimera également toutes les traductions associées
					à ce jeu.
				</p>
			</div>
			<div class="modal-action">
				<button class="btn btn-ghost" onclick={cancelDeleteGame}>Annuler</button>
				<button class="btn btn-error" onclick={deleteGame}>Supprimer</button>
			</div>
		</div>
	</div>
{/if}
