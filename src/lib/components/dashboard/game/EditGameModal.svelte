<script lang="ts">
	import OtherSiteImageWarning from '$lib/components/dashboard/OtherSiteImageWarning.svelte';

	export type EditingGameForm = {
		name: string;
		description: string;
		descriptionFr: string;
		website: string;
		threadId: string;
		tags: string;
		link: string;
		image: string;
		gameAutoCheck: boolean;
		gameVersion: string;
	};

	interface Props {
		open: boolean;
		gameWebsite: string;
		editingGame: EditingGameForm;
		showImagePreview: boolean;
		canManageGameAutoCheck: boolean;
		editGameAutoCheckAllowed: boolean;
		requireImage: boolean;
		onClose: () => void;
		onSubmit: () => void;
	}

	let {
		open,
		gameWebsite,
		editingGame = $bindable(),
		showImagePreview = $bindable(),
		canManageGameAutoCheck,
		editGameAutoCheckAllowed,
		requireImage,
		onClose,
		onSubmit
	}: Props = $props();
</script>

{#if open}
	<div class="modal-open modal">
		<div class="modal-box max-h-[90vh] max-w-7xl p-0">
			<div class="p-8">
				<h3 class="text-lg font-bold">Modifier le jeu</h3>
				<p class="mt-1 text-sm text-base-content/70">
					Mettez à jour les métadonnées du jeu sans modifier la logique existante.
				</p>
			</div>

			<div class="space-y-5 overflow-y-auto px-8">
				<div class="rounded-box border border-base-300 bg-base-200/30 p-4 md:p-5">
					<div class="mb-4">
						<h4 class="text-sm font-semibold text-base-content/80">Informations principales</h4>
					</div>
					<div
						class="mb-4 rounded-box border border-base-300 bg-base-100/70 p-3 text-sm text-base-content/80"
					>
						<p>
							Le <strong>moteur</strong> (Ren’Py, Unity, etc.) est défini
							<strong>par ligne de traduction</strong>
							: modifiez une traduction ou ajoutez-en une pour le renseigner.
						</p>
					</div>
					<div class="grid gap-4 md:grid-cols-2">
						<div class="form-control w-full">
							<label class="label" for="edit-game-name">
								<span class="label-text">Nom du jeu</span>
							</label>
							<input
								id="edit-game-name"
								type="text"
								placeholder="Nom du jeu"
								class="input-bordered input w-full"
								bind:value={editingGame.name}
								required
							/>
						</div>
						<div class="form-control w-full">
							<label class="label" for="edit-game-website">
								<span class="label-text">Site web</span>
							</label>
							{#if gameWebsite === 'lc'}
								<input
									id="edit-game-website"
									type="text"
									class="input-bordered input w-full"
									value="LewdCorner (lc)"
									readonly
									disabled
								/>
							{:else if gameWebsite === 'f95z'}
								<input
									id="edit-game-website"
									type="text"
									class="input-bordered input w-full"
									value="F95Zone (f95z)"
									readonly
									disabled
								/>
							{:else}
								<input
									id="edit-game-website"
									type="text"
									placeholder="other"
									class="input-bordered input w-full"
									bind:value={editingGame.website}
									required
								/>
							{/if}
						</div>
						<div class="form-control w-full">
							<label class="label" for="edit-game-threadId">
								<span class="label-text">ID du thread</span>
							</label>
							<input
								id="edit-game-threadId"
								type="text"
								placeholder="Ex: 12345"
								class="input-bordered input w-full"
								bind:value={editingGame.threadId}
							/>
							<p class="mt-1 text-xs text-base-content/60">
								Conservez l’ID brut du thread F95 pour les liens et l’auto-check.
							</p>
						</div>
						<div class="form-control w-full">
							<label class="label" for="edit-game-gameVersion">
								<span class="label-text">Version du jeu</span>
							</label>
							<input
								id="edit-game-gameVersion"
								type="text"
								placeholder="Ex: 1.2.3 — build du jeu côté thread"
								class="input-bordered input w-full"
								bind:value={editingGame.gameVersion}
							/>
							<p class="mt-1 text-xs text-base-content/60">
								Cette valeur peut alimenter les traductions en auto-check.
							</p>
						</div>
					</div>
				</div>

				<div class="rounded-box border border-base-300 bg-base-200/30 p-4 md:p-5">
					<div class="mb-4">
						<h4 class="text-sm font-semibold text-base-content/80">Liens et contenu</h4>
					</div>
					<div class="grid gap-4 md:grid-cols-2">
						<div class="form-control w-full">
							<label class="label" for="edit-game-link">
								<span class="label-text">Lien du thread</span>
							</label>
							<div class="join w-full">
								<input
									id="edit-game-link"
									type="url"
									placeholder="https://..."
									class="input-bordered input join-item w-full"
									bind:value={editingGame.link}
								/>
								<a
									class="btn join-item btn-outline"
									href={editingGame.link || '#'}
									target="_blank"
									rel="noopener noreferrer"
									aria-disabled={!editingGame.link}
									tabindex={editingGame.link ? undefined : -1}
								>
									Ouvrir
								</a>
							</div>
						</div>
						<OtherSiteImageWarning website={gameWebsite} class="w-full" />
						<div class="form-control w-full">
							<label class="label" for="edit-game-image">
								<span class="label-text">
									URL de l'image{requireImage ? '' : ' (optionnel)'}
								</span>
							</label>
							<div class="relative">
								<input
									id="edit-game-image"
									type="url"
									placeholder={requireImage ? 'https://...' : 'Laisser vide si aucune vignette'}
									class="input-bordered input w-full"
									bind:value={editingGame.image}
									onfocus={() => (showImagePreview = true)}
									onblur={() => (showImagePreview = false)}
									required={requireImage}
								/>
								{#if showImagePreview && editingGame.image?.trim()}
									<div
										class="absolute left-0 z-30 mt-2 w-full rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
									>
										<img
											src={editingGame.image}
											alt="Aperçu du visuel du jeu"
											class="max-h-56 w-full rounded-box object-cover"
										/>
									</div>
								{/if}
							</div>
						</div>
						<div class="form-control w-full">
							<label class="label" for="edit-game-tags">
								<span class="label-text">Tags</span>
							</label>
							<textarea
								id="edit-game-tags"
								placeholder="Ex: 3D, Adventure, Romance"
								class="textarea-bordered textarea min-h-28 w-full"
								bind:value={editingGame.tags}
							></textarea>
						</div>
						<div class="form-control w-full md:col-span-2">
							<label class="label" for="edit-game-description-fr">
								<span class="label-text">Description (français)</span>
							</label>
							<textarea
								id="edit-game-description-fr"
								placeholder="Description traduite en français"
								class="textarea-bordered textarea min-h-28 w-full"
								bind:value={editingGame.descriptionFr}
							></textarea>
							<p class="mt-1 text-xs text-base-content/60">
								Remplie automatiquement lors du scrape ou de l’actualisation. Modifiable
								manuellement.
							</p>
						</div>
						<div class="form-control w-full md:col-span-2">
							<label class="label" for="edit-game-description">
								<span class="label-text">Description (original)</span>
							</label>
							<textarea
								id="edit-game-description"
								placeholder="Description du jeu (langue source)"
								class="textarea-bordered textarea min-h-28 w-full"
								bind:value={editingGame.description}
							></textarea>
						</div>
					</div>
				</div>

				{#if canManageGameAutoCheck}
					<div class="rounded-box border border-base-300 bg-base-200/30 p-4 md:p-5">
						<div class="mb-4">
							<h4 class="text-sm font-semibold text-base-content/80">Paramètres avancés</h4>
						</div>
						<div
							class="rounded-box border border-base-300 bg-base-100/70 p-3 text-sm text-base-content/80"
						>
							{#if editGameAutoCheckAllowed}
								<p>
									Si l’<strong>auto-check jeu</strong> est désactivé, aucune traduction ne pourra avoir
									l’auto-check. S’il est activé, ce n’est pas obligatoire sur chaque ligne : vous choisissez
									traduction par traduction.
								</p>
							{:else}
								<p>
									L’auto-check jeu n’est disponible que lorsque le site web du jeu est
									<strong>F95Zone</strong> (<code class="text-xs">f95z</code>). Passez le site en
									F95Zone pour pouvoir l’activer.
								</p>
							{/if}
						</div>
						<label
							class="label mt-3 cursor-pointer rounded-box border border-base-300 bg-base-100/70 px-3 py-2 {!editGameAutoCheckAllowed
								? 'opacity-70'
								: ''}"
							for="edit-game-autocheck"
						>
							<input
								id="edit-game-autocheck"
								type="checkbox"
								class="toggle bg-base-200 toggle-sm"
								bind:checked={editingGame.gameAutoCheck}
								disabled={!editGameAutoCheckAllowed}
							/>
							<span class="label-text"
								>Auto-check jeu (autorise l’auto-check sur les traductions)</span
							>
						</label>
						<p class="mt-1 text-xs text-base-content/60">
							À activer seulement si vous souhaitez un suivi automatique des versions côté
							traductions.
						</p>
						{#if !editGameAutoCheckAllowed}
							<p class="mt-1 text-xs text-base-content/60">
								Choisissez le site F95Zone ci-dessus pour activer cette option.
							</p>
						{/if}
					</div>
				{/if}
			</div>

			<div
				class="sticky right-0 bottom-0 left-0 modal-action mt-6 w-full border-t border-base-300 bg-base-100/95 p-4 pt-4 backdrop-blur"
			>
				<button type="button" class="btn btn-ghost" onclick={onClose}>Annuler</button>
				<button type="button" class="btn btn-primary" onclick={onSubmit}>Modifier</button>
			</div>
		</div>
	</div>
{/if}
