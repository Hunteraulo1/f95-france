<script lang="ts">
	import type { SubmissionModalTranslator } from '$lib/components/dashboard/submissions/submission-modal-types';

	let {
		editTranslationTranslationName = $bindable(''),
		editTranslationVersion = $bindable(''),
		editTranslationTname = $bindable('translation'),
		editTranslationTversion = $bindable(''),
		editTranslationStatus = $bindable('in_progress'),
		editTranslationTtype = $bindable('manual'),
		editTranslationGameType = $bindable('other'),
		editTranslationTlink = $bindable(''),
		editTranslationAc = $bindable(false),
		editTranslationTranslatorId = $bindable(''),
		editTranslationProofreaderId = $bindable(''),
		translators = [],
		translationVersionRequired = false,
		translationVersionLocked = false,
		onEditTranslationTnameChange
	}: {
		editTranslationTranslationName?: string;
		editTranslationVersion?: string;
		editTranslationTname?: string;
		editTranslationTversion?: string;
		editTranslationStatus?: string;
		editTranslationTtype?: string;
		editTranslationGameType?: string;
		editTranslationTlink?: string;
		editTranslationAc?: boolean;
		editTranslationTranslatorId?: string;
		editTranslationProofreaderId?: string;
		translators?: SubmissionModalTranslator[];
		translationVersionRequired?: boolean;
		translationVersionLocked?: boolean;
		onEditTranslationTnameChange: () => void;
	} = $props();

	const translationLinkNotRequired = $derived(
		editTranslationTname === 'integrated' || editTranslationTname === 'no_translation'
	);
</script>

<div class="space-y-4">
	<h5 class="text-md font-semibold">Modifier la traduction</h5>
	<div class="grid gap-4 md:grid-cols-2">
		<div class="form-control md:col-span-2">
			<label class="label" for="editTranslationTranslationName">
				<span class="label-text">Nom de traduction</span>
			</label>
			<input
				id="editTranslationTranslationName"
				name="editTranslationTranslationName"
				class="input-bordered input w-full"
				type="text"
				placeholder="Nom de la traduction"
				bind:value={editTranslationTranslationName}
			/>
		</div>
		<div class="form-control">
			<label class="label" for="editTranslationVersion">
				<span class="label-text">Version de référence</span>
			</label>
			<input
				id="editTranslationVersion"
				name="editTranslationVersion"
				class="input-bordered input w-full"
				type="text"
				bind:value={editTranslationVersion}
			/>
		</div>
		<div class="form-control">
			<label class="label" for="editTranslationTversion">
				<span class="label-text">Version traduction</span>
			</label>
			<input
				id="editTranslationTversion"
				name="editTranslationTversion"
				class="input-bordered input w-full"
				type="text"
				bind:value={editTranslationTversion}
				required={translationVersionRequired}
				disabled={translationVersionLocked}
			/>
		</div>
		<div class="form-control">
			<label class="label" for="editTranslationTname">
				<span class="label-text">Statut de traduction</span>
			</label>
			<select
				id="editTranslationTname"
				name="editTranslationTname"
				class="select-bordered select w-full"
				bind:value={editTranslationTname}
				onchange={onEditTranslationTnameChange}
				required
			>
				<option value="no_translation">Pas de traduction</option>
				<option value="integrated">Intégrée</option>
				<option value="translation">Traduction</option>
				<option value="translation_with_mods">Traduction avec mods</option>
			</select>
		</div>
		<div class="form-control">
			<label class="label" for="editTranslationStatus">
				<span class="label-text">Statut</span>
			</label>
			<select
				id="editTranslationStatus"
				name="editTranslationStatus"
				class="select-bordered select w-full"
				bind:value={editTranslationStatus}
				required
			>
				<option value="in_progress">En cours</option>
				<option value="completed">Terminé</option>
				<option value="abandoned">Abandonné</option>
			</select>
		</div>
		<div class="form-control">
			<label class="label" for="editTranslationGameType">
				<span class="label-text">Moteur (cette ligne)</span>
			</label>
			<select
				id="editTranslationGameType"
				name="editTranslationGameType"
				class="select-bordered select w-full"
				bind:value={editTranslationGameType}
				required
			>
				<option value="renpy">Ren'Py</option>
				<option value="rpgm">RPGM</option>
				<option value="unity">Unity</option>
				<option value="unreal">Unreal</option>
				<option value="flash">Flash</option>
				<option value="html">HTML</option>
				<option value="qsp">QSP</option>
				<option value="other">Autre</option>
			</select>
		</div>
		<div class="form-control">
			<label class="label" for="editTranslationTtype">
				<span class="label-text">Type de traduction</span>
			</label>
			<select
				id="editTranslationTtype"
				name="editTranslationTtype"
				class="select-bordered select w-full"
				bind:value={editTranslationTtype}
				required
			>
				<option value="auto">Traduction automatique</option>
				<option value="vf">Traduction VO française</option>
				<option value="manual">Traduction humaine</option>
				<option value="semi-auto">Traduction semi-automatique</option>
				<option value="to_tested">À tester</option>
				<option value="hs">Lien trad HS</option>
			</select>
		</div>
		<div class="form-control">
			<label class="label" for="editTranslationTlink">
				<span class="label-text">Lien de traduction</span>
			</label>
			<div class="join w-full join-horizontal">
				<input
					id="editTranslationTlink"
					name="editTranslationTlink"
					class="input-bordered input join-item min-w-0 flex-1"
					type="url"
					placeholder="https://..."
					disabled={translationLinkNotRequired}
					bind:value={editTranslationTlink}
				/>
				<button
					type="button"
					class="btn join-item shrink-0 btn-outline"
					disabled={translationLinkNotRequired || !editTranslationTlink?.trim()}
					aria-label="Ouvrir le lien de traduction dans un nouvel onglet"
					onclick={() => {
						const u = editTranslationTlink?.trim();
						if (u) window.open(u, '_blank', 'noopener,noreferrer');
					}}
				>
					Ouvrir
				</button>
			</div>
		</div>
		<div class="form-control">
			<label class="label mt-6 h-10 cursor-pointer justify-start gap-3">
				<input
					type="checkbox"
					name="editTranslationAc"
					class="checkbox checkbox-sm"
					bind:checked={editTranslationAc}
				/>
				<span class="label-text">Auto-Check traduction</span>
			</label>
		</div>
		<div class="form-control">
			<label class="label" for="editTranslationTranslatorId">
				<span class="label-text">Traducteur</span>
			</label>
			<select
				id="editTranslationTranslatorId"
				name="editTranslationTranslatorId"
				class="select-bordered select w-full"
				bind:value={editTranslationTranslatorId}
			>
				<option value="">(aucun)</option>
				{#each translators as translator (translator.id)}
					<option value={translator.id}>{translator.name}</option>
				{/each}
			</select>
		</div>
		<div class="form-control">
			<label class="label" for="editTranslationProofreaderId">
				<span class="label-text">Relecteur</span>
			</label>
			<select
				id="editTranslationProofreaderId"
				name="editTranslationProofreaderId"
				class="select-bordered select w-full"
				bind:value={editTranslationProofreaderId}
			>
				<option value="">(aucun)</option>
				{#each translators as translator (translator.id)}
					<option value={translator.id}>{translator.name}</option>
				{/each}
			</select>
		</div>
	</div>
</div>
