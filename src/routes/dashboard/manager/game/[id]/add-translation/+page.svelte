<script lang="ts">
	import Checkbox from '$lib/components/dashboard/formGame/Checkbox.svelte';
	import Datalist from '$lib/components/dashboard/formGame/Datalist.svelte';
	import Dev from '$lib/components/dashboard/formGame/Dev.svelte';
	import Input from '$lib/components/dashboard/formGame/Input.svelte';
	import Select from '$lib/components/dashboard/formGame/Select.svelte';
	import { hasPermission } from '$lib/permissions/client';
	import { newToast } from '$lib/stores';
	import type { Translator } from '$lib/server/db/schema';
	import type { FormGameType } from '$lib/types';
	import { isNoTranslation, normalizeTranslationTversion } from '$lib/utils/game-form-validation';
	import { validateTranslationLinkField } from '$lib/utils/link-validation';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const canManageGameAutoCheck = $derived(data.canManageGameAutoCheck === true);
	const canUseSilentMode = $derived(data.canUseSilentMode === true);
	const canUseDevTools = $derived($hasPermission('dev.panel'));
	const addTranslatorMode = $derived(data.addContributorMode);
	const warnUnknownTranslators = $derived(data.warnUnknownTranslators === true);

	let translatorsList = $state<Translator[]>(
		untrack(() => data.translators as unknown as Translator[])
	);
	let pendingNewTranslators = $state<string[]>([]);
	let submitting = $state(false);
	let silentMode = $state(false);

	// Constante pour rendre tous les champs visibles (les composants formGame requièrent step + active)
	const STEP = 1;
	const ACTIVE = [1];

	let game = $state<FormGameType>({
		id: data.game.id,
		name: data.game.name,
		website: data.game.website,
		gameAutoCheck: data.game.gameAutoCheck ?? true,
		gameVersion: data.game.gameVersion,
		image: data.game.image ?? '',
		tags: '',
		threadId: null,
		link: '',
		description: null,
		descriptionFr: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		gameId: data.game.id,
		translationName: null,
		version: null,
		status: 'in_progress',
		tversion: '',
		tname: 'translation',
		tlink: '',
		ttype: 'auto',
		gameType: data.defaultGameType,
		translatorId: null,
		proofreaderId: null,
		ac: false,
		translatorAlertsEnabled: true
	});

	$effect(() => {
		if (game.tname === 'no_translation') {
			game.ttype = 'hs';
		}
	});

	const translatorFieldErrors = $derived.by(() => {
		const names = new Set(data.translators.map((t) => t.name));
		const tid = (game.translatorId ?? '').trim();
		const pid = (game.proofreaderId ?? '').trim();
		const conflict = Boolean(tid && tid === pid);
		const unknownT = warnUnknownTranslators && Boolean(tid) && !names.has(tid);
		const unknownP = warnUnknownTranslators && Boolean(pid) && !names.has(pid);
		return {
			translatorId: conflict || unknownT,
			proofreaderId: conflict || unknownP
		};
	});

	const fieldErrors = $derived.by(() => {
		const errs: Record<string, boolean> = {};
		const noTr = isNoTranslation(game.tname);
		const integ = game.tname === 'integrated';
		if (!noTr && !(game.tversion ?? '').trim()) errs.tversion = true;
		if (integ && (game.tversion ?? '').trim() !== 'Intégrée') errs.tversion = true;
		if (!noTr && !integ && !(game.tlink ?? '').trim()) errs.tlink = true;
		return errs;
	});

	const blockSubmit = $derived(
		Boolean(fieldErrors.tversion) ||
			Boolean(fieldErrors.tlink) ||
			translatorFieldErrors.translatorId ||
			translatorFieldErrors.proofreaderId
	);

	const handleSubmit = async (e: SubmitEvent) => {
		e.preventDefault();

		const linkNotRequired = isNoTranslation(game.tname) || game.tname === 'integrated';
		const tlinkError = validateTranslationLinkField({
			tlink: game.tlink ?? '',
			tname: game.tname
		});
		if (tlinkError) {
			newToast({ alertType: 'error', message: tlinkError });
			return;
		}

		submitting = true;
		try {
			const payload = {
				translationName: (game.translationName ?? '').trim() || null,
				version: (game.version ?? '').trim() || null,
				tversion: normalizeTranslationTversion(game.tname, game.tversion),
				status: game.status,
				ttype: game.ttype,
				gameType: game.gameType,
				tlink: linkNotRequired ? null : (game.tlink ?? '').trim() || null,
				tname: game.tname,
				translatorId: (game.translatorId ?? '').trim() || null,
				proofreaderId: (game.proofreaderId ?? '').trim() || null,
				silentMode: canUseSilentMode ? silentMode : false,
				...(pendingNewTranslators.length > 0 ? { pendingNewTranslators } : {})
			};

			const response = await fetch(`/dashboard/manager/game/${game.id}/translations`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			const result = await response.json();

			if (!response.ok) {
				newToast({ alertType: 'error', message: result.error || "Erreur lors de l'ajout" });
				return;
			}

			newToast({
				alertType: 'success',
				message: result.submission
					? 'Soumission créée avec succès. Elle sera examinée par un administrateur.'
					: 'Traduction ajoutée avec succès'
			});
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			await goto(resolve(`/dashboard/manager/game/${game.id}`), { invalidateAll: true });
		} catch {
			newToast({ alertType: 'error', message: 'Une erreur est survenue' });
		} finally {
			submitting = false;
		}
	};
</script>

<div class="mx-auto flex w-full max-w-7xl flex-col gap-4 px-3 sm:px-5 lg:px-8">
	<div class="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm sm:p-6">
		<div class="space-y-1">
			<h1 class="text-xl font-semibold sm:text-2xl">Ajouter une traduction</h1>
			<p class="text-sm text-base-content/60">{game.name}</p>
		</div>
	</div>

	<form
		class="relative flex w-full flex-col gap-5 rounded-box border border-base-300 bg-base-100 p-4 shadow-sm sm:p-6"
		onsubmit={handleSubmit}
		autocomplete="off"
	>
		<div class="rounded-box border border-base-300 bg-base-200/40 px-4 py-3">
			<div class="flex flex-wrap items-start justify-between gap-2">
				<h2 class="text-sm font-semibold text-base-content">Jeu en cours</h2>
			</div>
			<div class="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
				<div class="rounded-box bg-base-100 px-3 py-2">
					<p class="text-base-content/60">Nom</p>
					<p class="truncate font-medium">{game.name}</p>
				</div>
				<div class="rounded-box bg-base-100 px-3 py-2">
					<p class="text-base-content/60">Site</p>
					<p class="truncate font-medium">{game.website}</p>
				</div>
				<div class="rounded-box bg-base-100 px-3 py-2">
					<p class="text-base-content/60">Version du jeu</p>
					<p class="truncate font-medium">{game.gameVersion ?? '—'}</p>
				</div>
				<div class="rounded-box bg-base-100 px-3 py-2">
					<p class="text-base-content/60">Auto-check jeu</p>
					<p class="truncate font-medium">{game.gameAutoCheck ? 'Activé' : 'Désactivé'}</p>
				</div>
			</div>
		</div>

		<div
			class="grid w-full grid-cols-1 gap-5 rounded-box border border-base-300 bg-base-100 p-3 sm:p-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
		>
			<Input step={STEP} active={ACTIVE} name="translationName" title="Nom de la traduction" type="text" bind:game />
			<Select
				step={STEP}
				active={ACTIVE}
				name="gameType"
				title="Moteur"
				bind:game
				selectOptions={[
					{ value: 'renpy', label: 'RenPy' },
					{ value: 'rpgm', label: 'RPGM' },
					{ value: 'unity', label: 'Unity' },
					{ value: 'unreal', label: 'Unreal' },
					{ value: 'flash', label: 'Flash' },
					{ value: 'html', label: 'HTML' },
					{ value: 'qsp', label: 'QSP' },
					{ value: 'other', label: 'Autre' }
				]}
			/>
			<Input step={STEP} active={ACTIVE} name="version" title="Version de référence" type="text" bind:game />
			<Input step={STEP} active={ACTIVE} name="tversion" title="Version de la traduction" type="text" bind:game invalid={fieldErrors.tversion ?? false} />
			<Select
				step={STEP}
				active={ACTIVE}
				name="status"
				title="Statut de progression"
				bind:game
				selectOptions={[
					{ value: 'in_progress', label: 'En cours' },
					{ value: 'completed', label: 'Terminé' },
					{ value: 'abandoned', label: 'Abandonné' }
				]}
			/>
			<Select
				step={STEP}
				active={ACTIVE}
				name="tname"
				title="Statut de traduction"
				bind:game
				selectOptions={[
					{ value: 'no_translation', label: 'Pas de traduction' },
					{ value: 'integrated', label: 'Intégrée' },
					{ value: 'translation', label: 'Traduction' },
					{ value: 'translation_with_mods', label: 'Traduction (avec mods)' }
				]}
			/>
			<Input step={STEP} active={ACTIVE} name="tlink" title="Lien de la traduction" type="text" bind:game invalid={fieldErrors.tlink ?? false} />
			<Datalist
				step={STEP}
				active={ACTIVE}
				name="translatorId"
				title="Traducteur"
				bind:game
				bind:translators={translatorsList}
				addTranslatorMode={addTranslatorMode}
				bind:pendingNewTranslators
				invalid={translatorFieldErrors.translatorId}
			/>
			<Datalist
				step={STEP}
				active={ACTIVE}
				name="proofreaderId"
				title="Relecteur"
				bind:game
				bind:translators={translatorsList}
				addTranslatorMode={addTranslatorMode}
				bind:pendingNewTranslators
				invalid={translatorFieldErrors.proofreaderId}
			/>
			<Select
				step={STEP}
				active={ACTIVE}
				name="ttype"
				title="Type de traduction"
				bind:game
				selectOptions={[
					{ value: 'vf', label: 'VO Française' },
					{ value: 'manual', label: 'Relecture complète' },
					{ value: 'semi-auto', label: 'Relecture Partielle' },
					{ value: 'auto', label: 'Traduction Automatique' },
					{ value: 'to_tested', label: 'À tester' },
					{ value: 'hs', label: 'Lien Trad HS' }
				]}
			/>
			{#if canManageGameAutoCheck}
				<Checkbox step={STEP} active={ACTIVE} name="ac" title="Auto-check traduction" bind:game />
			{/if}
		</div>

		<div
			class="flex w-full flex-row flex-wrap items-center justify-between gap-3 rounded-box border border-base-300 bg-base-200/40 px-3 py-4 sm:px-4"
		>
			<a
				href={resolve(`/dashboard/manager/game/${data.game.id}`)}
				class="btn w-full btn-outline md:w-38"
			>
				Annuler
			</a>
			{#if canUseDevTools}
				<Dev bind:game />
			{/if}
			{#if canUseSilentMode}
				<label class="flex cursor-pointer items-center gap-2">
					<span class="label-text text-sm">Mode silencieux</span>
					<input type="checkbox" class="toggle toggle-primary toggle-sm" bind:checked={silentMode} />
				</label>
			{/if}
			<button
				class="btn w-full btn-primary md:w-38"
				type="submit"
				disabled={submitting || blockSubmit}
				title={blockSubmit ? "Corrigez les champs en erreur avant d'envoyer" : undefined}
			>
				{submitting ? 'Enregistrement…' : 'Ajouter la traduction'}
			</button>
		</div>
	</form>
</div>
