<script lang="ts">
	import { goto } from '$app/navigation';
	import Checkbox from '$lib/components/dashboard/formGame/Checkbox.svelte';
	import Datalist from '$lib/components/dashboard/formGame/Datalist.svelte';
	import Dev from '$lib/components/dashboard/formGame/Dev.svelte';
	import Input from '$lib/components/dashboard/formGame/Input.svelte';
	import InputImage from '$lib/components/dashboard/formGame/InputImage.svelte';
	import Insert from '$lib/components/dashboard/formGame/Insert.svelte';
	import Select from '$lib/components/dashboard/formGame/Select.svelte';
	import Textarea from '$lib/components/dashboard/formGame/Textarea.svelte';
	import { newToast } from '$lib/stores';
	import type { FormGameType } from '$lib/types';
	import { checkRole } from '$lib/utils';
	import { computeGameFormFieldState } from '$lib/utils/game-form-validation';
	import {
		formHasTranslatorInputIssue,
		getTranslatorFieldErrors
	} from '$lib/utils/translator-form-validation';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import { writable } from 'svelte/store';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	const isLoading = writable<boolean>(false);

	let { data }: Props = $props();
	let step = $state(0);

	// State locale pour le jeu
	let game = $state<FormGameType>({
		// Game fields
		id: '',
		name: '',
		tags: '',
		type: 'other',
		image: '',
		website: 'f95z',
		threadId: null,
		link: '',
		description: null,
		gameAutoCheck: true,
		gameVersion: null,
		createdAt: new Date(),
		updatedAt: new Date(),

		// GameTranslation fields
		gameId: '',
		translationName: null,
		status: 'in_progress',
		tversion: '',
		tname: 'no_translation',
		tlink: '',
		translatorId: null,
		proofreaderId: null,
		ttype: 'hs',
		ac: false
	});

	let silentMode = $state(false);
	let scraping = $state(false);
	let savedId = $state<number | null>(null);

	/** Valeurs normalisées après un scraping réussi — si l’utilisateur les modifie, Auto-Check repasse à false */
	type ScrapeBaseline = {
		name: string;
		tags: string;
		type: string;
		image: string;
		gameVersion: string;
	};
	let scrapeBaseline = $state<ScrapeBaseline | null>(null);

	const normScrapeField = (v: unknown): string => (v == null ? '' : String(v).trim());

	let threadDuplicateCheck = $state<{
		gameExists: boolean;
		pendingSubmission: boolean;
	} | null>(null);
	let checkingDuplicateThread = $state(false);

	const isAdmin = checkRole(['admin', 'superadmin']);

	let fieldFormState = $derived(computeGameFormFieldState(game));
	let translatorFieldErrors = $derived(
		getTranslatorFieldErrors(game, data.translators, data.warnUnknownTranslators)
	);
	let blockFinalSubmit = $derived(
		fieldFormState.hasBlockingError ||
			formHasTranslatorInputIssue(game, data.translators, data.warnUnknownTranslators)
	);

	const threadIdForDuplicateCheck = (v: FormGameType['threadId']): number | null => {
		if (v === null || v === undefined) return null;
		const n = typeof v === 'number' ? v : Number.parseInt(String(v), 10);
		if (Number.isNaN(n) || n <= 0) return null;
		return n;
	};

	$effect(() => {
		if (game.tname === 'no_translation') {
			game.ttype = 'hs';
		}
	});

	/** Auto-check traduction seulement si auto-check jeu (F95) ; pas l’inverse : on peut désactiver `ac`. */
	$effect(() => {
		if (game.gameAutoCheck === false) {
			game.ac = false;
		}
	});

	$effect(() => {
		const b = scrapeBaseline;
		if (!b) return;
		if (
			normScrapeField(game.name) !== b.name ||
			normScrapeField(game.tags) !== b.tags ||
			normScrapeField(game.type) !== b.type ||
			normScrapeField(game.image) !== b.image ||
			normScrapeField(game.gameVersion) !== b.gameVersion
		) {
			game.ac = false;
		}
	});

	const changeStep = async (amount: number): Promise<void> => {
		if (!game) throw new Error('no game data');

		if (step + amount >= 0 && step + amount <= 5) step += amount;
		if (step === 1 && game.website === 'other') step += amount;
		if (step === 2 && game.website === 'f95z') step += amount;

		if ((step === 4 && game.website === 'other' && isAdmin) || (step === 4 && !isAdmin))
			step += amount;
	};

	const scrapeData = async ({
		threadId,
		website
	}: {
		threadId: number | null;
		website: FormGameType['website'];
	}): Promise<void> => {
		if (!threadId || threadId === 0 || website !== 'f95z') return;

		try {
			scraping = true;
			const response = await fetch('/dashboard/manager/scrape', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ threadId, website })
			});

			const payload = await response.json();

			if (!response.ok || !payload.success) {
				throw new Error(payload.error ?? 'Erreur lors de la récupération des données du thread');
			}

			const data = payload.data as {
				name: string | null;
				version: string | null;
				status: string | null;
				tags: string | null;
				type: FormGameType['type'] | null;
				image: string | null;
			};

			game = {
				...game,
				name: data.name ?? game.name,
				tags: data.tags ?? game.tags,
				type: data.type ?? game.type,
				image: data.image ?? game.image,
				gameVersion: data.version ?? game.gameVersion
			};

			scrapeBaseline = {
				name: normScrapeField(game.name),
				tags: normScrapeField(game.tags),
				type: normScrapeField(game.type),
				image: normScrapeField(game.image),
				gameVersion: normScrapeField(game.gameVersion)
			};
			savedId = threadId;
		} catch (error) {
			console.warn('Erreur lors du scraping', error);
			newToast({
				alertType: 'error',
				message: 'Impossible de récupérer les informations du jeu'
			});
		} finally {
			scraping = false;
		}
	};

	const runThreadDuplicateCheckForTid = async (tid: number | null) => {
		if (tid === null) {
			threadDuplicateCheck = null;
			checkingDuplicateThread = false;
			return;
		}

		checkingDuplicateThread = true;
		try {
			const response = await fetch(
				`/dashboard/manager?threadIdCheck=${encodeURIComponent(String(tid))}`
			);
			const payload = (await response.json()) as {
				gameExists?: boolean;
				pendingSubmission?: boolean;
			};
			if (
				response.ok &&
				typeof payload.gameExists === 'boolean' &&
				typeof payload.pendingSubmission === 'boolean'
			) {
				threadDuplicateCheck = {
					gameExists: payload.gameExists,
					pendingSubmission: payload.pendingSubmission
				};
			} else {
				threadDuplicateCheck = null;
			}
		} catch {
			threadDuplicateCheck = null;
		} finally {
			checkingDuplicateThread = false;
		}
	};

	/** Vérif doublon + scrape F95 : uniquement après blur sur l’ID du thread */
	const handleThreadIdFieldBlur = async () => {
		const tid = threadIdForDuplicateCheck(game.threadId);
		await runThreadDuplicateCheckForTid(tid);

		if (!tid || game.website !== 'f95z') {
			if (!tid) savedId = null;
			return;
		}

		if (savedId === tid) return;

		await scrapeData({ threadId: tid, website: game.website });
	};

	const onInputBlurCommit = async (field: keyof FormGameType) => {
		if (field === 'threadId') await handleThreadIdFieldBlur();
	};

	const handleSubmit = async (event: SubmitEvent): Promise<void> => {
		event.preventDefault();

		if (!game) {
			newToast({
				alertType: 'error',
				message: 'Les informations du jeu sont manquantes'
			});
			return;
		}

		const fieldState = computeGameFormFieldState(game);
		if (fieldState.hasBlockingError) {
			newToast({
				alertType: 'error',
				message: 'Corrigez les champs obligatoires en erreur (bordure rouge).'
			});
			return;
		}

		if (formHasTranslatorInputIssue(game, data.translators, data.warnUnknownTranslators)) {
			newToast({
				alertType: 'error',
				message:
					'Corrigez le traducteur ou le relecteur (nom inconnu en base ou conflit entre les deux).'
			});
			return;
		}

		$isLoading = true;

		try {
			type GamePayload = {
				name: string;
				description: string | null;
				type: FormGameType['type'];
				website: FormGameType['website'];
				threadId: number | null;
				tags: string | null;
				link: string | null;
				image: string;
				gameVersion: string | null;
			};

			type TranslationPayload = {
				translationName: string;
				tversion: string;
				status: FormGameType['status'];
				ttype: FormGameType['ttype'];
				tlink: string | null;
				tname: FormGameType['tname'];
				translatorId: string | null;
				proofreaderId: string | null;
				ac: boolean;
			};

			const payload: { game: GamePayload; translation?: TranslationPayload } = {
				game: {
					name: game.name.trim(),
					description: game.description ?? null,
					type: game.type,
					website: game.website,
					threadId: game.threadId ?? null,
					tags: game.tags?.trim() || null,
					link: game.link?.trim() || null,
					image: game.image.trim(),
					gameVersion: game.gameVersion?.trim() || null
				}
			};

			const hasTranslationData =
				(game.translationName && game.translationName.trim().length > 0) ||
				(game.tversion && game.tversion.trim().length > 0) ||
				(game.tlink && game.tlink.trim().length > 0) ||
				(game.translatorId && game.translatorId.trim().length > 0) ||
				(game.proofreaderId && game.proofreaderId.trim().length > 0) ||
				game.tname !== 'no_translation';

			if (hasTranslationData) {
				const translationName =
					game.translationName?.trim().length && game.translationName?.trim().length > 0
						? game.translationName.trim()
						: game.translatorId?.trim().length && game.translatorId?.trim().length > 0
							? game.translatorId.trim()
							: `${payload.game.name} - traduction`;

				payload.translation = {
					translationName,
					tversion: game.tversion?.trim() || '',
					status: game.status,
					ttype: game.ttype,
					tlink: game.tlink?.trim() || null,
					tname: game.tname,
					translatorId: game.translatorId?.trim() || null,
					proofreaderId: game.proofreaderId?.trim() || null,
					ac: !!game.ac
				};
			}

			const response = await fetch('/dashboard/manager', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(payload)
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Erreur lors de la création du jeu');
			}

			newToast({
				alertType: 'success',
				message: result.message || 'Le jeu a bien été ajouté'
			});

			// eslint-disable-next-line svelte/no-navigation-without-resolve
			await goto('/dashboard/manager', { invalidateAll: true });
		} catch (error) {
			console.error('Error adding game', error);
			newToast({
				alertType: 'error',
				message: error instanceof Error ? error.message : "Impossible d'ajouter le jeu"
			});
		} finally {
			$isLoading = false;
		}
	};

	type Element = {
		Component:
			| typeof Select
			| typeof Input
			| typeof Textarea
			| typeof Datalist
			| typeof InputImage
			| typeof Checkbox;
		type?: HTMLInputElement['type'];
		values?: string[];
		selectOptions?: { value: string; label: string }[];
		title: string;
		className?: string;
		active?: number[];
		name: keyof FormGameType & string;
		needsTranslators?: boolean;
	};

	const elements: Element[] = [
		{
			Component: Select,
			active: [0, 5],
			title: 'Platforme',
			name: 'website',
			values: ['f95z', 'lc', 'other']
		},
		{
			Component: Input,
			active: [1, 5],
			title: 'ID du thread',
			name: 'threadId',
			type: 'number'
		},
		{
			Component: Input,
			active: [2, 5],
			title: 'Nom du jeu',
			name: 'name',
			type: 'text'
		},
		{
			Component: Input,
			active: [2, 5],
			title: 'Lien du jeu',
			name: 'link',
			type: 'text'
		},
		{
			Component: Textarea,
			active: [2, 5],
			title: 'Tags du jeu',
			name: 'tags'
		},
		{
			Component: Input,
			active: [2, 5],
			title: 'Type du jeu',
			name: 'type',
			type: 'text'
		},
		{
			Component: InputImage,
			active: [2, 5],
			title: "Lien de l'image du jeu",
			name: 'image'
		},
		{
			Component: Textarea,
			active: [2, 5],
			title: 'Description du jeu',
			name: 'description'
		},
		{
			Component: Input,
			active: [2, 5],
			title: 'Version du jeu (fiche)',
			name: 'gameVersion',
			type: 'text'
		},
		{
			Component: Input,
			active: [3, 5],
			title: 'Nom de la traduction',
			name: 'translationName',
			type: 'text'
		},
		{
			Component: Input,
			active: [3, 5],
			title: 'Version de la traduction',
			name: 'tversion',
			type: 'text'
		},
		{
			Component: Select,
			active: [3, 5],
			title: 'Status de la traduction',
			name: 'tname',
			selectOptions: [
				{ value: 'no_translation', label: 'Pas de traduction' },
				{ value: 'integrated', label: 'Intégrée' },
				{ value: 'translation', label: 'Traduction' },
				{ value: 'translation_with_mods', label: 'Traduction (avec mods)' }
			]
		},
		{
			Component: Input,
			active: [3, 5],
			title: 'Lien de la traduction',
			name: 'tlink',
			type: 'text'
		},
		{
			Component: Datalist,
			active: [3, 5],
			title: 'Traducteur',
			name: 'translatorId',
			needsTranslators: true
		},
		{
			Component: Datalist,
			active: [3, 5],
			title: 'Relecteur',
			name: 'proofreaderId',
			needsTranslators: true
		},
		{
			Component: Select,
			active: [3, 5],
			title: 'Type de Traduction',
			name: 'ttype',
			values: ['auto', 'vf', 'manual', 'semi-auto', 'to_tested', 'hs']
		},
		{
			Component: Checkbox,
			active: [4, 5],
			title: 'Auto-Check',
			name: 'ac'
		}
	];
</script>

{#if !$isLoading}
	<div class="mt-0 flex w-full flex-col items-center justify-center gap-4">
		<form
			class="relative flex w-full flex-col items-center"
			onsubmit={handleSubmit}
			autocomplete="off"
		>
			{#if scraping}
				<div class="left-0 flex items-center gap-1 lg:absolute">
					<LoaderCircle />
					Chargement des données en cours
				</div>
			{/if}
			{#if checkingDuplicateThread && threadIdForDuplicateCheck(game.threadId) !== null}
				<div class="w-full px-8 text-sm text-base-content/60">Vérification du thread…</div>
			{/if}
			{#if threadDuplicateCheck && (threadDuplicateCheck.gameExists || threadDuplicateCheck.pendingSubmission)}
				<div class="mb-2 alert w-full max-w-3xl alert-warning shadow-sm" role="alert">
					<div class="flex flex-col gap-1 text-sm">
						<span class="font-medium">Attention — conflit possible</span>
						<ul class="list-inside list-disc space-y-0.5">
							{#if threadDuplicateCheck.gameExists}
								<li>Un jeu avec cet ID de thread existe déjà dans la base.</li>
							{/if}
							{#if threadDuplicateCheck.pendingSubmission}
								<li>Une soumission pour ce thread est déjà en attente de validation.</li>
							{/if}
						</ul>
					</div>
				</div>
			{/if}
			{#if isAdmin}
				<div class="form-control">
					<label class="label cursor-pointer">
						<span class="label-text pr-2">Mode silencieux</span>
						<input
							type="checkbox"
							class="toggle"
							checked={silentMode}
							onchange={() => {
								silentMode = !silentMode;
							}}
						/>
					</label>
				</div>
			{/if}
			<div class="grid w-full grid-cols-1 gap-8 p-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{#each elements as { Component, name, title, active, className, values, selectOptions, type, needsTranslators } (name)}
					{#if needsTranslators && Component === Datalist}
						<Datalist
							{step}
							{name}
							{title}
							{active}
							{className}
							bind:game
							translators={data.translators}
							invalid={name === 'translatorId'
								? translatorFieldErrors.translatorId
								: translatorFieldErrors.proofreaderId}
						/>
					{:else}
						<Component
							{step}
							{name}
							{title}
							{active}
							{className}
							{values}
							{selectOptions}
							{type}
							bind:game
							invalid={fieldFormState.fieldErrors[name] ?? false}
							warn={fieldFormState.fieldWarns[name] ?? false}
							onBlurCommit={Component === Input ? onInputBlurCommit : undefined}
						/>
					{/if}
				{/each}
			</div>
			<div class="flex w-full flex-col justify-center gap-4 px-8 sm:flex-row">
				{#if step < 5}
					<button
						class="btn w-full btn-outline btn-primary sm:w-48"
						type="button"
						onclick={() => changeStep(-1)}
						disabled={step <= 0}
					>
						Précédent
					</button>
					<button
						class="btn w-full btn-primary sm:w-48"
						type="button"
						onclick={() => changeStep(1)}
					>
						Suivant
					</button>
				{:else}
					<button
						class="btn w-full btn-primary sm:w-48"
						type="submit"
						disabled={blockFinalSubmit}
						title={blockFinalSubmit
							? 'Corrigez les champs en erreur (rouge) avant d’envoyer — les avertissements (jaune) ne bloquent pas'
							: undefined}
					>
						Ajouter le jeu
					</button>
				{/if}
				{#if checkRole(['superadmin'])}
					<Dev bind:game />
				{/if}
				{#if game.website === 'lc' || game.website === 'f95z'}
					<Insert bind:game />
				{/if}
			</div>
		</form>
	</div>
{/if}
