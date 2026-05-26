<script lang="ts">
	import TranslatorContributorInput from '$lib/components/dashboard/TranslatorContributorInput.svelte';
	import type { AddTranslatorMode } from '$lib/components/dashboard/add-translator-mode';
	import { getGameEngineLabel } from '$lib/utils/game-engine-colors';
	import {
		GAME_ENGINE_SELECT_VALUES,
		getTranslationProgressLabel,
		getTranslationTypeLabel
	} from '$lib/utils/game-translation-labels';

	export type NewTranslationForm = {
		translationName: string;
		version: string;
		tversion: string;
		status: string;
		ttype: string;
		gameType: string;
		tlink: string;
		tname: string;
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
		newTranslation: NewTranslationForm;
		addTranslationSilentMode: boolean;
		extraTranslators: TranslatorOption[];
		pendingNewTranslators: string[];
		canManageGameAutoCheck: boolean;
		canUseSilentMode: boolean;
		translationAcUiAllowed: boolean;
		addContributorMode: AddTranslatorMode | false;
		addTranslationAutoCheckPreview: boolean;
		addTranslationTversionLocked: boolean;
		onClose: () => void;
		onSubmit: () => void;
	}

	let {
		open,
		game,
		translators,
		newTranslation = $bindable(),
		addTranslationSilentMode = $bindable(false),
		extraTranslators = $bindable<TranslatorOption[]>([]),
		pendingNewTranslators = $bindable<string[]>([]),
		canManageGameAutoCheck,
		canUseSilentMode,
		translationAcUiAllowed,
		addContributorMode,
		addTranslationAutoCheckPreview,
		addTranslationTversionLocked,
		onClose,
		onSubmit
	}: Props = $props();
</script>

{#if open}
	<div class="modal-open modal">
		<div class="modal-box max-h-[90vh] max-w-7xl overflow-y-auto">
			<div class="mb-5">
				<h3 class="text-lg font-bold">Ajouter une traduction</h3>
				<p class="mt-1 text-sm text-base-content/70">
					Même structure que la modification : renseignez le type de traduction en premier —
					certains champs se désactivent seuls (intégrée, pas de traduction).
				</p>
				<div class="mt-3 flex flex-wrap gap-2">
					<span class="badge badge-outline">
						Statut: {getTranslationProgressLabel(newTranslation.status)}
					</span>
					<span class="badge badge-outline">
						Type: {getTranslationTypeLabel(newTranslation.ttype)}
					</span>
					<span class="badge badge-outline">
						Moteur: {getGameEngineLabel(newTranslation.gameType)}
					</span>
				</div>
			</div>

			<div class="rounded-box border border-base-300 bg-base-200/30 p-4">
				<div class="mb-3">
					<h4 class="text-sm font-semibold text-base-content/80">Informations principales</h4>
				</div>
				<div class="grid gap-4 md:grid-cols-2">
					<div class="form-control w-full md:col-span-2">
						<label class="input" for="add-tr-translationName">
							Nom de la traduction
							<input
								id="add-tr-translationName"
								type="text"
								placeholder="Ex: Saison 1, VF communauté…"
								class="w-full input-ghost"
								bind:value={newTranslation.translationName}
								required
							/>
						</label>
						<p class="mt-1 text-xs text-base-content/60">
							Nom court et reconnaissable (Épisode 2, Saison 2, Chapitre 2, etc.).
						</p>
					</div>

					<div class="form-control w-full">
						<label class="label" for="add-tr-tname">
							<span class="label-text">Statut de traduction</span>
						</label>
						<select
							id="add-tr-tname"
							class="select-bordered select w-full"
							bind:value={newTranslation.tname}
							required
						>
							<option value="no_translation">Pas de traduction</option>
							<option value="integrated">Intégrée</option>
							<option value="translation">Traduction</option>
							<option value="translation_with_mods">Traduction avec mods</option>
						</select>
					</div>

					<div class="form-control w-full">
						<label class="label" for="add-tr-status">
							<span class="label-text">Progression</span>
						</label>
						<select
							id="add-tr-status"
							class="select-bordered select w-full"
							bind:value={newTranslation.status}
							required
						>
							<option value="in_progress">En cours</option>
							<option value="completed">Terminé</option>
							<option value="abandoned">Abandonné</option>
						</select>
					</div>

					<div class="form-control w-full">
						<label class="label" for="add-tr-ttype">
							<span class="label-text">Type de traduction</span>
						</label>
						<select
							id="add-tr-ttype"
							class="select-bordered select w-full"
							bind:value={newTranslation.ttype}
							disabled={newTranslation.tname === 'no_translation'}
							required
						>
							<option value="vf">VO Française</option>
							<option value="manual">Traduction humaine</option>
							<option value="semi-auto">Traduction semi-automatique</option>
							<option value="auto">Traduction automatique</option>
							<option value="to_tested">À tester</option>
							<option value="hs">Lien trad HS</option>
						</select>
					</div>

					<div class="form-control w-full">
						<label class="label" for="add-tr-game-type">
							<span class="label-text">Moteur du jeu</span>
						</label>
						<select
							id="add-tr-game-type"
							class="select-bordered select w-full"
							bind:value={newTranslation.gameType}
							required
						>
							{#each GAME_ENGINE_SELECT_VALUES as v (v)}
								<option value={v}>{getGameEngineLabel(v)}</option>
							{/each}
						</select>
					</div>
				</div>
			</div>

			<div class="divider my-5">Versions et lien</div>
			<div class="rounded-box border border-base-300 bg-base-200/30 p-4">
				<div class="grid gap-4 md:grid-cols-2">
					<div class="form-control w-full">
						<label class="label" for="add-tr-version">
							<span class="label-text">Version de référence</span>
						</label>
						<div class="join join-horizontal w-full">
							<input
								id="add-tr-version"
								type="text"
								placeholder="Ex: 1.2"
								class="input-bordered input join-item min-w-0 flex-1"
								bind:value={newTranslation.version}
							/>
							<button
								type="button"
								class="btn join-item shrink-0 btn-outline"
								disabled={!(game.gameVersion ?? '').trim()}
								onclick={() => {
									const latest = (game.gameVersion ?? '').trim();
									if (!latest) return;
									newTranslation.version = latest;
								}}
							>
								Copier
							</button>
						</div>
						<p class="mt-1 text-xs text-base-content/60">
							Dernière version de la Saison/Épisode/Chapitre/... sortie.
						</p>
						{#if newTranslation.tname === 'integrated' && translationAcUiAllowed && (game.gameVersion ?? '').trim()}
							<p class="mt-1 text-xs text-base-content/60">
								Intégrée : l’auto-check à la création s’active si cette version est identique à la
								version du jeu sur la fiche ({(game.gameVersion ?? '').trim()}).
							</p>
						{/if}
					</div>

					<div class="form-control w-full">
						<label class="label" for="add-tr-tversion">
							<span class="label-text">Version de traduction</span>
						</label>
						<input
							id="add-tr-tversion"
							type="text"
							placeholder="Ex: 1.0"
							class="input-bordered input w-full"
							bind:value={newTranslation.tversion}
							disabled={addTranslationTversionLocked}
							required
						/>
						<p class="mt-1 text-xs text-base-content/60">
							Version de la traduction. Doit être identique à la version de référence pour être à
							jour.
						</p>
					</div>

					<div class="form-control w-full md:col-span-2">
						<label class="label" for="add-tr-tlink">
							<span class="label-text">Lien de traduction</span>
						</label>
						<div class="join join-horizontal w-full">
							<input
								id="add-tr-tlink"
								type="url"
								placeholder="https://…"
								class="input-bordered input join-item min-w-0 flex-1"
								bind:value={newTranslation.tlink}
								disabled={newTranslation.tname === 'integrated' ||
									newTranslation.tname === 'no_translation'}
								required={newTranslation.tname !== 'integrated' &&
									newTranslation.tname !== 'no_translation'}
							/>
							<button
								type="button"
								class="btn join-item shrink-0 btn-outline"
								disabled={newTranslation.tname === 'integrated' ||
									newTranslation.tname === 'no_translation' ||
									!newTranslation.tlink?.trim()}
								aria-label="Ouvrir le lien dans un nouvel onglet"
								onclick={() => {
									const u = newTranslation.tlink?.trim();
									if (u) window.open(u, '_blank', 'noopener,noreferrer');
								}}
							>
								Ouvrir
							</button>
						</div>
						<p class="mt-1 text-xs text-base-content/60">
							Lien direct vers la publication/source de la traduction.
						</p>
					</div>
				</div>
			</div>

			{#if canManageGameAutoCheck}
				<div class="mt-5 rounded-box border border-base-300 bg-base-200/30 p-4 md:p-5">
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
									L’<strong>auto-check du jeu</strong> est désactivé sur cette fiche. À la création,
									l’auto-check de cette traduction sera donc mis à <strong>false</strong>.
								</p>
								<p class="mt-2 text-base-content/70">
									Pour le réactiver : ouvrez <strong>Modifier le jeu</strong> et cochez l’auto-check jeu.
								</p>
							{:else}
								<p>
									L’auto-check est calculé automatiquement à la création :
									<strong>true</strong> si la traduction est <strong>Intégrée</strong>,
									<strong>Pas de traduction</strong> ou si la version de référence est égale à la version
									du jeu.
								</p>
							{/if}
						</div>
					</div>

					<label
						class="label cursor-pointer justify-start gap-3 rounded-box border border-base-300 bg-base-100/70 px-3 py-2 opacity-70"
					>
						<input
							type="checkbox"
							class="checkbox checkbox-sm"
							checked={addTranslationAutoCheckPreview}
							disabled
						/>
						<span class="label-text">Auto-check traduction (aperçu automatique)</span>
					</label>
					<p class="mt-1 text-xs text-base-content/60">
						Ce statut est informatif : il est recalculé côté serveur lors de l’enregistrement.
					</p>
				</div>
			{/if}

			<div class="divider my-5">Contributeurs</div>
			<div class="rounded-box border border-base-300 bg-base-200/30 p-4">
				<div class="grid gap-4 md:grid-cols-2">
					<TranslatorContributorInput
						id="add-tr-translator"
						listId="add-tr-translators-list"
						label="Traducteur"
						placeholder="Nom du traducteur"
						bind:value={newTranslation.translatorId}
						baseTranslators={translators}
						bind:extraTranslators
						addTranslatorMode={addContributorMode}
						bind:pendingNewTranslators
						onDirectTranslatorCreated={() => window.location.reload()}
					/>
					<TranslatorContributorInput
						id="add-tr-proofreader"
						listId="add-tr-proofreaders-list"
						label="Relecteur"
						placeholder="Nom du relecteur"
						bind:value={newTranslation.proofreaderId}
						baseTranslators={translators}
						bind:extraTranslators
						addTranslatorMode={addContributorMode}
						bind:pendingNewTranslators
						onDirectTranslatorCreated={() => window.location.reload()}
					/>
				</div>
			</div>

			{#if canUseSilentMode}
				<div
					class="mt-5 flex w-full flex-wrap items-center justify-between gap-3 rounded-box bg-base-200/60 px-4 py-3"
				>
					<p class="text-sm text-base-content/80">
						Désactive l'envoi d'une notification sur Discord.
					</p>
					<label class="label cursor-pointer gap-2 p-0">
						<span class="label-text">Mode silencieux</span>
						<input
							type="checkbox"
							class="toggle toggle-primary toggle-sm"
							bind:checked={addTranslationSilentMode}
						/>
					</label>
				</div>
			{/if}

			<div
				class="sticky right-0 bottom-0 left-0 modal-action mt-6 w-full border-t border-base-300 bg-base-100/95 p-4 pt-4 backdrop-blur"
			>
				<button type="button" class="btn btn-ghost" onclick={onClose}>Annuler</button>
				<button type="button" class="btn btn-primary" onclick={onSubmit}>Ajouter</button>
			</div>
		</div>
	</div>
{/if}
