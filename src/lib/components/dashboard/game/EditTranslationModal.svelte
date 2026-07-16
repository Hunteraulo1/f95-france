<script lang="ts">
	import TranslatorContributorInput from '$lib/components/dashboard/TranslatorContributorInput.svelte';
	import type { AddTranslatorMode } from '$lib/components/dashboard/add-translator-mode';
	import { newToast } from '$lib/stores';
	import { getGameEngineLabel } from '$lib/utils/game-engine-colors';
	import { GAME_ENGINE_SELECT_VALUES } from '$lib/utils/game-translation-labels';

	export type EditingTranslationForm = {
		translationName: string;
		id: string;
		version: string;
		tversion: string;
		status: string;
		ttype: string;
		gameType: string;
		tlink: string;
		tname: 'no_translation' | 'integrated' | 'translation' | 'translation_with_mods';
		ac: boolean;
		translatorId: string;
		proofreaderId: string;
	};

	type GameContext = {
		gameVersion?: string | null;
		website: string;
		gameAutoCheck?: boolean | null;
	};

	type TranslatorOption = { id: string; name: string };

	interface Props {
		open: boolean;
		game: GameContext;
		translators: TranslatorOption[];
		editingTranslation: EditingTranslationForm;
		editTranslationSilentMode: boolean;
		extraTranslators: TranslatorOption[];
		pendingNewTranslators: string[];
		canShowInternalIds: boolean;
		canManageGameAutoCheck: boolean;
		canUseSilentMode: boolean;
		canManuallyEditTranslationAc: boolean;
		canShowTranslationAcCheckbox: boolean;
		editTranslationLinkNotRequired: boolean;
		editTranslationVersionsLockedByAc: boolean;
		editTranslationReferenceVersionLockedByAc: boolean;
		addContributorMode: AddTranslatorMode | false;
		onClose: () => void;
		onSubmit: () => void;
	}

	let {
		open,
		game,
		translators,
		editingTranslation = $bindable(),
		editTranslationSilentMode = $bindable(false),
		extraTranslators = $bindable<TranslatorOption[]>([]),
		pendingNewTranslators = $bindable<string[]>([]),
		canShowInternalIds,
		canManageGameAutoCheck,
		canUseSilentMode,
		canManuallyEditTranslationAc,
		canShowTranslationAcCheckbox,
		editTranslationLinkNotRequired,
		editTranslationVersionsLockedByAc,
		editTranslationReferenceVersionLockedByAc,
		addContributorMode,
		onClose,
		onSubmit
	}: Props = $props();
</script>

{#if open}
	<div class="modal-open modal">
		<div class="modal-box max-h-[90vh] max-w-7xl p-0">
			<div class="p-8">
				<h3 class="text-lg font-bold">Modifier la traduction</h3>
				<p class="mt-1 text-sm text-base-content/70">
					Mettez à jour la ligne de traduction sans perdre les informations existantes.
				</p>
			</div>

			<div class="space-y-5 overflow-y-auto px-8">
				{#if canShowInternalIds}
					<div class="mb-4">
						<button
							type="button"
							class="badge max-w-full overflow-hidden badge-outline text-left badge-sm hover:bg-base-200"
							title="Copier l’ID de la traduction"
							onclick={() => {
								navigator.clipboard.writeText(editingTranslation.id);
								newToast({
									alertType: 'success',
									message: 'ID de la traduction copié dans le presse-papiers'
								});
							}}
						>
							ID: {editingTranslation.id}
						</button>
					</div>
				{/if}

				{#key editingTranslation.id}
					<div class="space-y-5">
						<div class="rounded-box border border-base-300 bg-base-200/30 p-4 md:p-5">
							<div class="mb-4">
								<h4 class="text-sm font-semibold text-base-content/80">Informations principales</h4>
							</div>
							<div class="grid gap-4 md:grid-cols-2">
								<div class="form-control w-full md:col-span-2">
									<label class="label" for="edit-translationName">
										<span class="label-text">Nom de la traduction</span>
									</label>
									<input
										id="edit-translationName"
										type="text"
										placeholder="Ex: Saison 1"
										class="input-bordered input w-full"
										bind:value={editingTranslation.translationName}
										required
									/>
								</div>

								<div class="form-control w-full">
									<label class="label" for="edit-tname">
										<span class="label-text">Statut de traduction</span>
									</label>
									<select
										id="edit-tname"
										class="select-bordered select w-full"
										bind:value={editingTranslation.tname}
									>
										<option value="no_translation">Pas de traduction</option>
										<option value="integrated">Intégrée</option>
										<option value="translation">Traduction</option>
										<option value="translation_with_mods">Traduction avec mods</option>
									</select>
									<p class="mt-1 text-xs text-base-content/60">
										Définit les contraintes de version et si le lien devient optionnel.
									</p>
								</div>

								<div class="form-control w-full">
									<label class="label" for="edit-status">
										<span class="label-text">Progression</span>
									</label>
									<select
										id="edit-status"
										class="select-bordered select w-full text-nowrap"
										bind:value={editingTranslation.status}
									>
										<option value="in_progress">En cours</option>
										<option value="completed">Terminé</option>
										<option value="abandoned">Abandonné</option>
									</select>
								</div>

								<div class="form-control w-full">
									<label class="label" for="edit-ttype">
										<span class="label-text">Type de traduction</span>
									</label>
									<select
										id="edit-ttype"
										class="select-bordered select w-full"
										bind:value={editingTranslation.ttype}
										disabled={editingTranslation.tname === 'no_translation'}
									>
										<option value="vf">VO Française</option>
										<option value="manual">Traduction Humaine</option>
										<option value="semi-auto">Traduction Semi-Automatique</option>
										<option value="auto">Traduction Automatique</option>
										<option value="to_tested">À tester</option>
										<option value="hs">Lien Trad HS</option>
									</select>
									<p class="mt-1 text-xs text-base-content/60">
										Utilisez « Lien Trad HS » si le lien ne fonctionne plus.
									</p>
								</div>

								<div class="form-control w-full">
									<label class="label" for="edit-game-type">
										<span class="label-text">Moteur du jeu</span>
									</label>
									<select
										id="edit-game-type"
										class="select-bordered select w-full"
										bind:value={editingTranslation.gameType}
									>
										{#each GAME_ENGINE_SELECT_VALUES as v (v)}
											<option value={v}>{getGameEngineLabel(v)}</option>
										{/each}
									</select>
								</div>
							</div>
						</div>

						<div class="rounded-box border border-base-300 bg-base-200/30 p-4 md:p-5">
							<div class="mb-4">
								<h4 class="text-sm font-semibold text-base-content/80">Versions et lien</h4>
							</div>
							<div class="grid gap-4 md:grid-cols-2">
								<div class="form-control w-full">
									<label class="label" for="edit-version">
										<span class="label-text">Version de référence</span>
									</label>
									<div class="join w-full join-horizontal">
										<input
											id="edit-version"
											type="text"
											placeholder="Ex: 1.2"
											class="input-bordered input join-item min-w-0 flex-1"
											bind:value={editingTranslation.version}
											disabled={editTranslationReferenceVersionLockedByAc}
										/>
										<button
											type="button"
											class="btn join-item shrink-0 btn-outline"
											disabled={editTranslationReferenceVersionLockedByAc ||
												!(game.gameVersion ?? '').trim()}
											onclick={() => {
												const latest = (game.gameVersion ?? '').trim();
												if (!latest) return;
												editingTranslation.version = latest;
											}}
										>
											Copier
										</button>
									</div>
									<p class="mt-1 text-xs text-base-content/60">
										Dernière version de la Saison/Épisode/Chapitre/... sortie.
									</p>
									{#if editTranslationReferenceVersionLockedByAc}
										<p class="mt-1 text-xs text-base-content/60">
											Version verrouillée tant que l’auto-check traduction est actif.
										</p>
									{/if}
								</div>

								<div class="form-control w-full">
									<label class="label" for="edit-tversion">
										<span class="label-text">Version de traduction</span>
									</label>
									<div class="join w-full join-horizontal">
										<input
											id="edit-tversion"
											type="text"
											placeholder="Ex: 1.0"
											class="input-bordered input join-item min-w-0 flex-1"
											bind:value={editingTranslation.tversion}
											disabled={editTranslationLinkNotRequired || editTranslationVersionsLockedByAc}
											required
										/>
										<button
											type="button"
											class="btn join-item shrink-0 btn-outline"
											disabled={editTranslationLinkNotRequired ||
												editTranslationVersionsLockedByAc ||
												!(editingTranslation.version ?? '').trim()}
											onclick={() => {
												const ref = (editingTranslation.version ?? '').trim();
												if (!ref) return;
												editingTranslation.tversion = ref;
											}}
										>
											Copier
										</button>
									</div>
									<p class="mt-1 text-xs text-base-content/60">
										Indiquez la version réellement publiée de la traduction. Doit être identique à
										la version de référence pour être à jour.
									</p>
									{#if editTranslationVersionsLockedByAc}
										<p class="mt-1 text-xs text-base-content/60">
											Pour une traduction intégrée, la version reste « Intégrée » et la version de
											référence suit automatiquement la version du jeu.
										</p>
									{/if}
								</div>

								<div class="form-control w-full md:col-span-2">
									<label class="label" for="edit-tlink">
										<span class="label-text">Lien de traduction</span>
									</label>
									<div class="join w-full join-horizontal">
										<input
											id="edit-tlink"
											type="url"
											placeholder="https://..."
											class="input-bordered input join-item min-w-0 flex-1"
											bind:value={editingTranslation.tlink}
											disabled={editTranslationLinkNotRequired}
											required={!editTranslationLinkNotRequired}
										/>
										<button
											type="button"
											class="btn join-item shrink-0 btn-outline"
											disabled={editTranslationLinkNotRequired || !editingTranslation.tlink?.trim()}
											aria-label="Ouvrir le lien dans un nouvel onglet"
											onclick={() => {
												const u = editingTranslation.tlink?.trim();
												if (u) window.open(u, '_blank', 'noopener,noreferrer');
											}}
										>
											Ouvrir
										</button>
									</div>
									<p class="mt-1 text-xs text-base-content/60">
										Laissez vide uniquement pour « Intégrée » ou « Pas de traduction ».
									</p>
								</div>
							</div>
						</div>
					</div>
				{/key}

				<div class="rounded-box border border-base-300 bg-base-200/30 p-4 md:p-5">
					<div class="mb-4">
						<h4 class="text-sm font-semibold text-base-content/80">Auto-check</h4>
					</div>
					<div class="form-control mb-4 w-full">
						<div
							class="rounded-box border border-base-300 bg-base-100/70 p-4 text-sm text-base-content/80"
						>
							{#if game.website !== 'f95z'}
								<p>
									L’auto-check traduction n’est prévu que pour les jeux <strong>F95Zone</strong>.
									Sur ce site, il reste désactivé.
								</p>
							{:else if game.gameAutoCheck === false}
								<p>
									L’<strong>auto-check du jeu</strong> est désactivé sur cette fiche. À
									l’enregistrement, l’auto-check de <strong>cette</strong> traduction sera donc mis
									à
									<strong>false</strong>
									(même si la ligne était marquée en auto-check auparavant).
								</p>
								{#if canManageGameAutoCheck}
									<p class="mt-2 text-base-content/70">
										Pour pouvoir l’activer ici : ouvrez <strong>Modifier le jeu</strong> (en haut de la
										page), puis cochez l’auto-check jeu pour ce thread F95.
									</p>
								{/if}
							{:else if canManuallyEditTranslationAc}
								<p>
									Vous pouvez activer l’auto-check sur cette ligne. S’il est actif, la version de
									référence suit le jeu ; pour une traduction <strong>intégrée</strong>, la Trad.
									Ver. reste « Intégrée ».
								</p>
							{:else if !canManageGameAutoCheck}
								<p>
									Vous n’avez pas le droit <strong>Auto-check (jeu et traductions)</strong>. Un
									administrateur peut l’activer pour votre rôle dans
									<a href="/dashboard/roles" class="link link-primary">Gestion des rôles</a>.
								</p>
							{:else}
								<p>L’auto-check de cette traduction n’est pas modifiable dans cet état.</p>
							{/if}
						</div>
					</div>

					{#if canShowTranslationAcCheckbox}
						<div class="form-control w-full">
							<label
								class="label cursor-pointer justify-start gap-3 rounded-box border border-base-300 bg-base-100/70 px-3 py-2 {!canManuallyEditTranslationAc
									? 'opacity-70'
									: ''}"
							>
								<input
									type="checkbox"
									class="checkbox checkbox-sm"
									bind:checked={editingTranslation.ac}
									disabled={!canManuallyEditTranslationAc}
								/>
								<span class="label-text">Auto-check traduction</span>
							</label>
							<p class="mt-1 text-xs text-base-content/60">
								Activez cette option si cette ligne doit suivre automatiquement la version du jeu.
							</p>
							{#if !canManuallyEditTranslationAc && game.website === 'f95z' && game.gameAutoCheck === false}
								<p class="mt-1 text-xs text-base-content/60">
									Réactivez d’abord l’auto-check du jeu pour cocher cette case.
								</p>
							{/if}
						</div>
					{/if}
				</div>

				<div class="rounded-box border border-base-300 bg-base-200/30 p-4 md:p-5">
					<div class="mb-4">
						<h4 class="text-sm font-semibold text-base-content/80">Contributeurs</h4>
					</div>
					<div class="grid gap-4 md:grid-cols-2">
						<TranslatorContributorInput
							id="edit-translator"
							listId="edit-translator-list"
							label="Traducteur"
							placeholder="Nom du traducteur"
							bind:value={editingTranslation.translatorId}
							baseTranslators={translators}
							bind:extraTranslators
							addTranslatorMode={addContributorMode}
							bind:pendingNewTranslators
							inputClass="input-bordered input"
							onDirectTranslatorCreated={() => window.location.reload()}
						/>
						<TranslatorContributorInput
							id="edit-proofreader"
							listId="edit-proofreader-list"
							label="Relecteur"
							placeholder="Nom du relecteur"
							bind:value={editingTranslation.proofreaderId}
							baseTranslators={translators}
							bind:extraTranslators
							addTranslatorMode={addContributorMode}
							bind:pendingNewTranslators
							onDirectTranslatorCreated={() => window.location.reload()}
						/>
					</div>
				</div>

				{#if canUseSilentMode}
					<div class="rounded-box border border-base-300 bg-base-200/30 p-4 md:p-5">
						<p class="text-sm text-base-content/80">
							Désactive l'envoi d'une notification sur Discord.
						</p>
						<label class="label cursor-pointer gap-2 p-0">
							<span class="label-text">Mode silencieux</span>
							<input
								type="checkbox"
								class="toggle toggle-primary toggle-sm"
								bind:checked={editTranslationSilentMode}
							/>
						</label>
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
