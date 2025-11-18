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
	import { LoaderCircle } from '@lucide/svelte';
	import { writable } from 'svelte/store';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	const isLoading = writable<boolean>(false);

	let { data }: Props = $props();
	let step = $state(0);

	let translators = $state(data.translators);

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
		createdAt: new Date(),
		updatedAt: new Date(),

		// GameTranslation fields
		gameId: '',
		translationName: null,
		status: 'in_progress',
		version: '',
		tversion: '',
		tname: 'translation',
		tlink: '',
		translatorId: null,
		proofreaderId: null,
		ttype: 'manual',
		ac: false
	});

	let silentMode = $state(false);
	let scraping = $state(false);
	let savedId = $state<number | null>(null);

	const isAdmin = checkRole(['admin', 'superadmin']);

	const changeStep = async (amount: number): Promise<void> => {
		if (!game) throw new Error('no game data');

		if (step + amount >= 0 && step + amount <= 5) step += amount;
		if (step === 1 && game.website === 'other') step += amount;
		if (step === 2 && game.website === 'f95z') step += amount;

		if ((step === 4 && game.website === 'other' && isAdmin) || (step === 4 && !isAdmin))
			step += amount;

		const gameId = game.threadId;

		if (step === 3 && game.website === 'f95z' && gameId && savedId !== gameId) {
			const { threadId } = game;

			savedId = gameId;

			await scrapeData({ threadId, website: game.website });
		}
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
				version: data.version ?? game.version
			};
		} catch (error) {
			console.error('Erreur lors du scraping', error);
			newToast({
				alertType: 'error',
				message: 'Impossible de récupérer les informations du jeu'
			});
		} finally {
			scraping = false;
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

		const requiredFields: Array<keyof FormGameType> = ['name', 'type', 'website', 'image'];
		const missingField = requiredFields.find((field) => {
			const value = game[field];
			return value === null || value === undefined || value === '';
		});

		if (missingField) {
			newToast({
				alertType: 'error',
				message: `Le champ ${missingField} est requis`
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
			};

			type TranslationPayload = {
				translationName: string;
				version: string;
				tversion: string;
				status: FormGameType['status'];
				ttype: FormGameType['ttype'];
				tlink: string | null;
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
					image: game.image.trim()
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
					version: game.version?.trim() || '',
					tversion: game.tversion?.trim() || '',
					status: game.status,
					ttype: game.ttype,
					tlink: game.tlink?.trim() || null
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
			title: 'Version du jeu',
			name: 'version',
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
			values: ['Pas de traduction', 'Intégrée', 'Traduction', 'Traduction (avec mods)']
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
				{#each elements as { Component, name, title, active, className, values, type, needsTranslators } (name)}
					{#if needsTranslators && Component === Datalist}
						<Datalist {step} {name} {title} {active} {className} bind:game bind:translators />
					{:else}
						<Component {step} {name} {title} {active} {className} {values} {type} bind:game />
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
					<button class="btn w-full btn-primary sm:w-48" type="submit"> Ajouter le jeu </button>
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
