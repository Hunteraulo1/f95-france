<script lang="ts">
	import { goto, replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Checkbox from '$lib/components/dashboard/formGame/Checkbox.svelte';
	import Datalist from '$lib/components/dashboard/formGame/Datalist.svelte';
	import Dev from '$lib/components/dashboard/formGame/Dev.svelte';
	import Input from '$lib/components/dashboard/formGame/Input.svelte';
	import InputImage from '$lib/components/dashboard/formGame/InputImage.svelte';
	import Insert from '$lib/components/dashboard/formGame/Insert.svelte';
	import Select from '$lib/components/dashboard/formGame/Select.svelte';
	import Textarea from '$lib/components/dashboard/formGame/Textarea.svelte';
	import { newToast } from '$lib/stores';
	import type { FormGameType, GameEngineType } from '$lib/types';
	import { checkRole } from '$lib/utils';
	import { computeGameFormFieldState } from '$lib/utils/game-form-validation';
	import {
		formHasTranslatorInputIssue,
		getTranslatorFieldErrors
	} from '$lib/utils/translator-form-validation';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import { onMount } from 'svelte';
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
		gameType: 'other',
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
		version: null,
		status: 'in_progress',
		tversion: '',
		tname: 'translation',
		tlink: '',
		translatorId: null,
		proofreaderId: null,
		ttype: 'auto',
		ac: false
	});

	let scraping = $state(false);
	let savedId = $state<number | null>(null);

	/** Valeurs normalisées après un scraping réussi — si l’utilisateur les modifie, Auto-Check repasse à false */
	type ScrapeBaseline = {
		name: string;
		tags: string;
		gameType: string;
		image: string;
		gameVersion: string;
		description: string;
	};
	let scrapeBaseline = $state<ScrapeBaseline | null>(null);
	/** LC : état du scrape image (idle = pas encore tenté sur ce thread). */
	let lcScrapeStatus = $state<'idle' | 'ok' | 'no_image' | 'failed'>('idle');

	const lcScrapeFailed = $derived(game.website === 'lc' && lcScrapeStatus === 'failed');
	const lcImageLocked = $derived(
		game.website === 'lc' && (lcScrapeStatus === 'failed' || lcScrapeStatus === 'no_image')
	);
	const lcShowImageField = $derived(
		game.website === 'lc' && lcScrapeStatus === 'ok' && !!game.image?.trim()
	);
	const lcImageReadOnly = $derived(game.website === 'lc' && lcScrapeStatus === 'ok');

	const normScrapeField = (v: unknown): string => (v == null ? '' : String(v).trim());
	const supportsThreadScrape = $derived(game.website === 'f95z' || game.website === 'lc');

	let threadDuplicateCheck = $state<{
		gameExists: boolean;
		pendingSubmission: boolean;
	} | null>(null);
	let hasThreadConflict = $derived(
		Boolean(threadDuplicateCheck?.gameExists || threadDuplicateCheck?.pendingSubmission)
	);
	let checkingDuplicateThread = $state(false);
	let pendingQueryThreadIdAutoScrape = $state(false);
	let skipThreadStepFromQueryParam = $state(false);
	let prefilledTranslatorApplied = $state(false);

	const safeCheckRole = (roles: Parameters<typeof checkRole>[0]): boolean => {
		try {
			return checkRole(roles);
		} catch {
			return false;
		}
	};

	const isAdmin = safeCheckRole(['admin', 'superadmin']);
	const maxStep = $derived(isAdmin ? 5 : 3);
	let stepLabels = $derived(
		isAdmin
			? ['Site', 'Thread', 'Infos jeu', 'Traduction', 'Auto-check', 'Validation']
			: ['Site', 'Thread', 'Infos jeu', 'Traduction']
	);

	let fieldFormState = $derived(
		computeGameFormFieldState(game, {
			requireImage: game.website !== 'lc' || lcShowImageField
		})
	);
	let translatorFieldErrors = $derived(
		getTranslatorFieldErrors(game, data.translators, data.warnUnknownTranslators)
	);
	let blockFinalSubmit = $derived(
		fieldFormState.hasBlockingError ||
			formHasTranslatorInputIssue(game, data.translators, data.warnUnknownTranslators)
	);

	const buildGameLinkFromThread = (
		website: FormGameType['website'],
		threadId: FormGameType['threadId']
	): string => {
		const parsedThreadId =
			typeof threadId === 'number' ? threadId : Number.parseInt(String(threadId ?? ''), 10);
		if (Number.isNaN(parsedThreadId) || parsedThreadId <= 0) return '';
		if (website === 'f95z') return `https://f95zone.to/threads/${parsedThreadId}`;
		if (website === 'lc') return `https://lewdcorner.com/threads/${parsedThreadId}`;
		return '';
	};

	onMount(() => {
		const threadIdRaw = new URLSearchParams(window.location.search).get('threadId');
		if (!threadIdRaw) return;
		const parsed = Number.parseInt(threadIdRaw, 10);
		if (Number.isNaN(parsed) || parsed <= 0) return;
		if (game.threadId === null || game.threadId === 0) {
			game.threadId = parsed;
		}
		game.link = buildGameLinkFromThread(game.website, game.threadId);
		skipThreadStepFromQueryParam = true;
		// Ne pas scraper avant l'étape 3 quand l'ID vient du query param.
		// On garde le déclenchement automatique pour plus tard.
		pendingQueryThreadIdAutoScrape = true;
		void runThreadDuplicateCheckForTid(threadIdForDuplicateCheck(game.threadId));
		replaceState(resolve('/dashboard/manager/add'), page.state);
	});

	const threadIdForDuplicateCheck = (v: FormGameType['threadId']): number | null => {
		if (v === null || v === undefined) return null;
		const n = typeof v === 'number' ? v : Number.parseInt(String(v), 10);
		if (Number.isNaN(n) || n <= 0) return null;
		return n;
	};

	$effect(() => {
		if (prefilledTranslatorApplied) return;
		const prefilled = data.prefilledTranslatorName;
		if (
			!isAdmin &&
			typeof prefilled === 'string' &&
			prefilled.trim().length > 0 &&
			!game.translatorId
		) {
			game.translatorId = prefilled.trim();
		}
		prefilledTranslatorApplied = true;
	});

	$effect(() => {
		if (game.tname === 'no_translation') {
			game.ttype = 'hs';
		}
	});

	$effect(() => {
		// Règle métier: pour le site "other", pas de threadId.
		if (game.website === 'other' && game.threadId !== null) {
			game.threadId = null;
			savedId = null;
			threadDuplicateCheck = null;
			pendingQueryThreadIdAutoScrape = false;
		}
	});

	$effect(() => {
		if (game.website !== 'lc') {
			lcScrapeStatus = 'idle';
			return;
		}
		if (lcImageLocked) {
			game.image = '';
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
			normScrapeField(game.gameType) !== b.gameType ||
			normScrapeField(game.image) !== b.image ||
			normScrapeField(game.gameVersion) !== b.gameVersion ||
			normScrapeField(game.description) !== b.description
		) {
			game.ac = false;
		}
	});

	const isScrapeUnchanged = (): boolean => {
		const b = scrapeBaseline;
		if (!b) return false;
		return (
			normScrapeField(game.name) === b.name &&
			normScrapeField(game.tags) === b.tags &&
			normScrapeField(game.gameType) === b.gameType &&
			normScrapeField(game.image) === b.image &&
			normScrapeField(game.gameVersion) === b.gameVersion &&
			normScrapeField(game.description) === b.description
		);
	};

	const changeStep = async (amount: number): Promise<void> => {
		if (!game) throw new Error('no game data');
		const previousStep = step;
		let targetStep = step + amount;

		if (targetStep < 0) targetStep = 0;
		if (targetStep > maxStep) targetStep = maxStep;

		if (
			targetStep === 1 &&
			(game.website === 'other' || (game.website === 'f95z' && skipThreadStepFromQueryParam))
		) {
			targetStep += amount;
		}

		const movingForwardFromThread =
			amount > 0 && previousStep === 1 && targetStep >= 2 && supportsThreadScrape;
		const deferredAutoScrape =
			amount > 0 && pendingQueryThreadIdAutoScrape && targetStep >= 3 && supportsThreadScrape;

		if (movingForwardFromThread || deferredAutoScrape) {
			pendingQueryThreadIdAutoScrape = false;
			await handleThreadIdFieldBlur();
		}

		const skipInfosStep =
			game.website === 'f95z' || (game.website === 'lc' && lcScrapeStatus !== 'failed');

		if (targetStep === 2 && skipInfosStep) {
			targetStep += amount;
		}

		// Scrape LC en échec : depuis Traduction, « Précédent » doit revenir aux infos (pas au thread).
		if (
			amount < 0 &&
			game.website === 'lc' &&
			lcScrapeStatus === 'failed' &&
			previousStep >= 3 &&
			targetStep === 1
		) {
			targetStep = 2;
		}

		// Scrape LC en échec : obliger l’étape « Infos jeu » (saisie manuelle).
		if (
			amount > 0 &&
			game.website === 'lc' &&
			lcScrapeStatus === 'failed' &&
			previousStep < 2 &&
			targetStep > 2
		) {
			targetStep = 2;
		}

		if (targetStep < 0) targetStep = 0;
		if (targetStep > maxStep) targetStep = maxStep;

		step = targetStep;
	};

	const requiresThreadIdForNextStep = $derived(
		step === 1 && (game.website === 'f95z' || game.website === 'lc')
	);
	const hasValidThreadIdForNextStep = $derived(threadIdForDuplicateCheck(game.threadId) !== null);
	const blockNextStepForMissingThread = $derived(
		requiresThreadIdForNextStep && !hasValidThreadIdForNextStep
	);

	const scrapeData = async ({
		threadId,
		website
	}: {
		threadId: number | null;
		website: FormGameType['website'];
	}): Promise<boolean> => {
		if (!threadId || threadId === 0 || (website !== 'f95z' && website !== 'lc')) return false;

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
				gameType: GameEngineType | null;
				image: string | null;
				description: string | null;
			};

			const scrapedImage = data.image?.trim() ?? '';
			if (website === 'lc') {
				lcScrapeStatus = scrapedImage ? 'ok' : 'no_image';
			}

			game = {
				...game,
				name: data.name ?? game.name,
				tags: data.tags ?? game.tags,
				gameType: data.gameType ?? game.gameType,
				image: website === 'lc' ? scrapedImage : (data.image ?? game.image),
				gameVersion: data.version ?? game.gameVersion,
				description: data.description ?? game.description
			};

			scrapeBaseline = {
				name: normScrapeField(game.name),
				tags: normScrapeField(game.tags),
				gameType: normScrapeField(game.gameType),
				image: normScrapeField(game.image),
				gameVersion: normScrapeField(game.gameVersion),
				description: normScrapeField(game.description)
			};
			savedId = threadId;
			return true;
		} catch (error) {
			console.warn('Erreur lors du scraping', error);
			if (website === 'lc') {
				lcScrapeStatus = 'failed';
				game = {
					...game,
					name: '',
					tags: '',
					gameType: 'other',
					image: '',
					gameVersion: null,
					description: null,
					link: buildGameLinkFromThread('lc', threadId),
					gameAutoCheck: false
				};
				scrapeBaseline = null;
				savedId = threadId;
				newToast({
					alertType: 'warning',
					message:
						'Scrape LewdCorner impossible — renseignez les informations du jeu à l’étape suivante (sans vignette).'
				});
				return false;
			}
			newToast({
				alertType: 'error',
				message: 'Impossible de récupérer les informations du jeu'
			});
			return false;
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

	/** Vérif doublon + scrape F95 (déclenché au passage d'étape). */
	const handleThreadIdFieldBlur = async () => {
		const tid = threadIdForDuplicateCheck(game.threadId);
		await runThreadDuplicateCheckForTid(tid);

		if (!tid || !supportsThreadScrape) {
			if (!tid) {
				savedId = null;
				if (game.website === 'lc') {
					lcScrapeStatus = 'idle';
					game.image = '';
				}
			}
			return;
		}

		if (game.website === 'lc' && tid !== savedId) {
			lcScrapeStatus = 'idle';
			game.image = '';
		}

		if (savedId === tid) return;

		await scrapeData({ threadId: tid, website: game.website });
	};

	const onInputBlurCommit = async (field: keyof FormGameType) => {
		// Ne pas scraper au blur: seulement vérifier les doublons pendant la saisie.
		if (field === 'threadId') {
			await runThreadDuplicateCheckForTid(threadIdForDuplicateCheck(game.threadId));
		}
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
				type: GameEngineType;
				website: FormGameType['website'];
				threadId: number | null;
				tags: string | null;
				link: string | null;
				image: string;
				gameVersion: string | null;
				scrapeUnchanged: boolean;
			};

			type TranslationPayload = {
				translationName: string;
				version: string | null;
				tversion: string;
				status: FormGameType['status'];
				ttype: FormGameType['ttype'];
				tlink: string | null;
				tname: FormGameType['tname'];
				translatorId: string | null;
				proofreaderId: string | null;
			};

			const payload: { game: GamePayload; translation?: TranslationPayload } = {
				game: {
					name: game.name.trim(),
					description: game.description ?? null,
					type: game.gameType,
					website: game.website,
					threadId: game.website === 'other' ? null : (game.threadId ?? null),
					tags: game.tags?.trim() || null,
					link: game.link?.trim() || null,
					image: game.image.trim() || '',
					gameVersion: game.gameVersion?.trim() || null,
					scrapeUnchanged: isScrapeUnchanged()
				}
			};

			const hasTranslationData =
				(game.translationName && game.translationName.trim().length > 0) ||
				(game.version && game.version.trim().length > 0) ||
				(game.tversion && game.tversion.trim().length > 0) ||
				(game.tlink && game.tlink.trim().length > 0) ||
				(game.translatorId && game.translatorId.trim().length > 0) ||
				(game.proofreaderId && game.proofreaderId.trim().length > 0) ||
				game.tname !== 'no_translation';

			if (hasTranslationData) {
				const translationName =
					game.translationName?.trim().length && game.translationName?.trim().length > 0
						? game.translationName.trim()
						: `${payload.game.name} - traduction`;

				payload.translation = {
					translationName,
					version: game.version?.trim() || null,
					tversion: game.tversion?.trim() || '',
					status: game.status,
					ttype: game.ttype,
					tlink: game.tlink?.trim() || null,
					tname: game.tname,
					translatorId: game.translatorId?.trim() || null,
					proofreaderId: game.proofreaderId?.trim() || null
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
		adminOnly?: boolean;
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
			Component: Select,
			active: [2, 5],
			title: 'Moteur du jeu',
			name: 'gameType',
			selectOptions: [
				{ value: 'renpy', label: 'RenPy' },
				{ value: 'rpgm', label: 'RPGM' },
				{ value: 'unity', label: 'Unity' },
				{ value: 'unreal', label: 'Unreal' },
				{ value: 'flash', label: 'Flash' },
				{ value: 'html', label: 'HTML' },
				{ value: 'qsp', label: 'QSP' },
				{ value: 'other', label: 'Autre' }
			]
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
			title: 'Version du jeu',
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
			title: 'Version de référence',
			name: 'version',
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
			title: 'Statut de progression',
			name: 'status',
			selectOptions: [
				{ value: 'in_progress', label: 'En cours' },
				{ value: 'completed', label: 'Terminé' },
				{ value: 'abandoned', label: 'Abandonné' }
			]
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
			selectOptions: [
				{ value: 'vf', label: 'VO Française' },
				{ value: 'manual', label: 'Relecture complète' },
				{ value: 'semi-auto', label: 'Relecture Partielle' },
				{ value: 'auto', label: 'Traduction Automatique' },
				{ value: 'to_tested', label: 'À tester' },
				{ value: 'hs', label: 'Lien Trad HS' }
			]
		},
		{
			Component: Checkbox,
			active: [4, 5],
			title: 'Auto-check jeu',
			name: 'gameAutoCheck',
			adminOnly: true
		},
		{
			Component: Checkbox,
			active: [4, 5],
			title: 'Auto-check traduction',
			name: 'ac',
			adminOnly: true
		}
	];
</script>

{#if !$isLoading}
	<div class="mx-auto flex w-full max-w-7xl flex-col gap-4 px-3 sm:px-5 lg:px-8">
		<div class="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm sm:p-6">
			<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div class="space-y-1">
					<h1 class="text-xl font-semibold sm:text-2xl">Ajouter un jeu</h1>
				</div>
				<ul class="steps steps-horizontal mt-4 hidden overflow-x-auto xl:flex">
					{#each stepLabels as label, index (label)}
						<li class="step {index <= step ? 'step-primary' : ''} text-xs">{label}</li>
					{/each}
				</ul>
				<div class="badge badge-outline badge-lg badge-primary">
					Étape {step + 1} / {maxStep + 1}
				</div>
			</div>
		</div>

		<form
			class="relative flex w-full flex-col gap-5 rounded-box border border-base-300 bg-base-100 p-4 shadow-sm sm:p-6"
			onsubmit={handleSubmit}
			autocomplete="off"
		>
			{#if scraping}
				<div class="alert flex items-center gap-2 alert-soft text-sm alert-info">
					<LoaderCircle />
					Chargement des données en cours
				</div>
			{/if}
			{#if checkingDuplicateThread && threadIdForDuplicateCheck(game.threadId) !== null}
				<div class="w-full text-sm text-base-content/60">Vérification du thread…</div>
			{/if}
			{#if lcScrapeFailed}
				<div class="alert text-sm alert-warning" role="status">
					<span>
						Scrape LewdCorner impossible — complétez le nom, les tags, le moteur, la version et la
						description du jeu (étape Infos jeu). Aucune vignette ne sera ajoutée.
					</span>
				</div>
			{:else if lcImageLocked}
				<div class="alert text-sm alert-warning" role="status">
					<span>
						Scrape LewdCorner sans image — la vignette reste vide et ne peut pas être modifiée
						manuellement.
					</span>
				</div>
			{/if}
			{#if threadDuplicateCheck && hasThreadConflict}
				<div class="mb-1 alert w-full alert-warning shadow-sm" role="alert">
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

			<div
				class="flex w-full flex-wrap items-center justify-between gap-3 rounded-box bg-base-200/60 px-4 py-3"
			>
				<div class="text-sm text-base-content/80">
					<span class="font-medium">Section active :</span>
					{stepLabels[step]}
				</div>
			</div>

			<div class="rounded-box border border-base-300 bg-base-200/40 px-4 py-3">
				<div class="flex flex-wrap items-start justify-between gap-2">
					<h2 class="text-sm font-semibold text-base-content">Jeu en cours</h2>
					{#if hasThreadConflict}
						<span class="badge badge-sm badge-warning">Conflit thread</span>
					{/if}
				</div>
				<div class="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
					<div class="rounded-box bg-base-100 px-3 py-2">
						<p class="text-base-content/60">Site</p>
						<p class="truncate font-medium">{game.website}</p>
					</div>
					<div class="rounded-box bg-base-100 px-3 py-2">
						<p class="text-base-content/60">Thread ID</p>
						<p class="truncate font-medium">{game.threadId ?? '—'}</p>
					</div>
					<div class="rounded-box bg-base-100 px-3 py-2">
						<p class="text-base-content/60">Nom</p>
						<p class="truncate font-medium">{game.name?.trim() ? game.name : '—'}</p>
					</div>
					<div class="rounded-box bg-base-100 px-3 py-2">
						<p class="text-base-content/60">Version</p>
						<p class="truncate font-medium">{game.gameVersion?.trim() ? game.gameVersion : '—'}</p>
					</div>
				</div>
			</div>

			<div
				class="grid w-full grid-cols-1 gap-5 rounded-box border border-base-300 bg-base-100 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3 xl:grid-cols-4"
			>
				{#each elements as { Component, name, title, active, className, values, selectOptions, type, needsTranslators, adminOnly } (name)}
					{#if name === 'image' && game.website === 'lc' && !lcShowImageField}
						<!-- LC : pas de champ image tant que le scrape n’a pas fourni d’URL -->
					{:else if !adminOnly || isAdmin}
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
								readonly={name === 'image' && lcImageReadOnly}
								onBlurCommit={Component === Input ? onInputBlurCommit : undefined}
							/>
						{/if}
					{/if}
				{/each}
			</div>

			<div
				class="flex w-full flex-row flex-wrap items-center justify-between gap-3 rounded-box border border-base-300 bg-base-200/40 px-3 py-4 sm:px-4"
			>
				{#if step > 0}
					<button
						class="btn w-full btn-outline btn-primary md:w-38"
						type="button"
						onclick={() => changeStep(-1)}
					>
						Précédent
					</button>
				{/if}
				{#if game.website === 'lc' || game.website === 'f95z'}
					<Insert bind:game />
				{/if}
				{#if step < maxStep}
					<button
						class="btn w-full btn-primary md:w-38"
						type="button"
						onclick={() => changeStep(1)}
						disabled={blockNextStepForMissingThread}
						title={blockNextStepForMissingThread ? 'Thread ID requis' : undefined}
					>
						Suivant
					</button>
				{:else}
					<button
						class="btn w-full btn-primary md:w-38"
						type="submit"
						disabled={blockFinalSubmit}
						title={blockFinalSubmit
							? 'Corrigez les champs en erreur (rouge) avant d’envoyer — les avertissements (jaune) ne bloquent pas'
							: undefined}
					>
						Ajouter le jeu
					</button>
				{/if}
				{#if safeCheckRole(['superadmin'])}
					<Dev
						bind:game
						onDevDataApplied={() => {
							step = maxStep;
						}}
					/>
				{/if}
			</div>
		</form>
	</div>
{/if}
