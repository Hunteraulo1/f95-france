<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Checkbox from '$lib/components/dashboard/formGame/Checkbox.svelte';
	import Dev from '$lib/components/dashboard/formGame/Dev.svelte';
	import Input from '$lib/components/dashboard/formGame/Input.svelte';
	import InputImage from '$lib/components/dashboard/formGame/InputImage.svelte';
	import Select from '$lib/components/dashboard/formGame/Select.svelte';
	import Textarea from '$lib/components/dashboard/formGame/Textarea.svelte';
	import { hasPermission } from '$lib/permissions/client';
	import { newToast } from '$lib/stores';
	import type { FormGameType } from '$lib/types';
	import { gameAutoCheckEnabledForWebsite } from '$lib/utils/game-auto-check';
	import { normalizeGameImageForStorage } from '$lib/utils/game-form-validation';
	import { validateGameLinkFields } from '$lib/utils/link-validation';
	import { untrack } from 'svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const canManageGameAutoCheck = $derived(data.canManageGameAutoCheck === true);
	const canUseSilentMode = $derived(data.canUseSilentMode === true);
	const canUseDevTools = $derived($hasPermission('dev.panel'));

	// Constante pour rendre tous les champs visibles
	const STEP = 1;
	const ACTIVE = [1];

	let submitting = $state(false);
	let silentMode = $state(false);

	function initialGame(data: PageData): FormGameType {
		return {
			id: data.game.id,
			name: data.game.name,
			website: data.game.website,
			threadId: data.game.threadId,
			link: data.game.link ?? '',
			tags: data.game.tags ?? '',
			image: data.game.image ?? '',
			description: data.game.description,
			descriptionFr: data.game.descriptionFr,
			gameAutoCheck: data.game.gameAutoCheck ?? true,
			gameVersion: data.game.gameVersion,
			createdAt: data.game.createdAt,
			updatedAt: data.game.updatedAt,
			// Translation fields (unused)
			gameId: data.game.id,
			translationName: null,
			version: null,
			status: 'in_progress',
			tversion: '',
			tname: 'translation',
			tlink: '',
			ttype: 'auto',
			gameType: 'other',
			translatorId: null,
			proofreaderId: null,
			ac: false,
			translatorAlertsEnabled: true
		};
	}

	let game = $state(untrack(() => initialGame(data)));

	$effect(() => {
		if (!gameAutoCheckEnabledForWebsite(game.website)) {
			game.gameAutoCheck = false;
		}
	});

	const editGameAutoCheckAllowed = $derived(gameAutoCheckEnabledForWebsite(game.website));

	const fieldErrors = $derived.by(() => {
		const errs: Record<string, boolean> = {};
		if (!(game.name ?? '').trim()) errs.name = true;
		if (!(game.website ?? '').trim()) errs.website = true;
		return errs;
	});

	const blockSubmit = $derived(Boolean(fieldErrors.name) || Boolean(fieldErrors.website));

	const handleSubmit = async (e: SubmitEvent) => {
		e.preventDefault();

		const gameAutoCheck = editGameAutoCheckAllowed ? game.gameAutoCheck : false;
		const storedImage = normalizeGameImageForStorage(game.website, game.image, { gameAutoCheck });

		const linkError = validateGameLinkFields({
			link: (game.link ?? '').trim(),
			image: storedImage,
			requireLink: true,
			requireImage: false
		});
		if (linkError) {
			newToast({ alertType: 'error', message: linkError });
			return;
		}

		submitting = true;
		try {
			const response = await fetch(`/dashboard/manager/game/${game.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: (game.name ?? '').trim(),
					description: game.description ?? '',
					description_fr: game.descriptionFr ?? '',
					website: game.website,
					threadId: game.threadId ? String(game.threadId) : '',
					tags: game.tags ?? '',
					link: (game.link ?? '').trim(),
					image: storedImage,
					gameAutoCheck: Boolean(gameAutoCheck),
					gameVersion: (game.gameVersion ?? '').trim() || null,
					silentMode: canUseSilentMode ? silentMode : false
				})
			});

			const result = await response.json();

			if (!response.ok) {
				newToast({ alertType: 'error', message: result.error || 'Erreur lors de la modification' });
				return;
			}

			newToast({
				alertType: 'success',
				message: result.submission
					? 'Soumission créée avec succès. Elle sera examinée par un administrateur.'
					: 'Jeu modifié avec succès'
			});
			await goto(resolve(`/dashboard/manager/game/${data.game.id}`), { invalidateAll: true });
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
			<h1 class="text-xl font-semibold sm:text-2xl">Modifier le jeu</h1>
			<p class="text-sm text-base-content/60">{game.name}</p>
		</div>
	</div>

	<form
		class="relative flex w-full flex-col gap-5 rounded-box border border-base-300 bg-base-100 p-4 shadow-sm sm:p-6"
		onsubmit={handleSubmit}
		autocomplete="off"
	>
		<div
			class="grid w-full grid-cols-1 gap-5 rounded-box border border-base-300 bg-base-100 p-3 sm:p-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
		>
			<Input
				step={STEP}
				active={ACTIVE}
				name="name"
				title="Nom du jeu"
				type="text"
				bind:game
				invalid={fieldErrors.name ?? false}
			/>
			<Select
				step={STEP}
				active={ACTIVE}
				name="website"
				title="Site web"
				bind:game
				selectOptions={[
					{ value: 'f95z', label: 'F95Zone' },
					{ value: 'lc', label: 'LewdCorner' },
					{ value: 'other', label: 'Autre' }
				]}
			/>
			<Input
				step={STEP}
				active={ACTIVE}
				name="threadId"
				title="ID du thread"
				type="number"
				bind:game
			/>
			<Input
				step={STEP}
				active={ACTIVE}
				name="gameVersion"
				title="Version du jeu"
				type="text"
				bind:game
			/>
			<Input step={STEP} active={ACTIVE} name="link" title="Lien du thread" type="text" bind:game />
			<InputImage step={STEP} active={ACTIVE} name="image" title="URL de l'image" bind:game />
			<Textarea step={STEP} active={ACTIVE} name="tags" title="Tags" bind:game />
			<Textarea
				step={STEP}
				active={ACTIVE}
				name="descriptionFr"
				title="Description (français)"
				bind:game
			/>
			<Textarea
				step={STEP}
				active={ACTIVE}
				name="description"
				title="Description (original)"
				bind:game
			/>
			{#if canManageGameAutoCheck}
				<Checkbox
					step={STEP}
					active={ACTIVE}
					name="gameAutoCheck"
					title="Auto-check jeu"
					bind:game
				/>
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
					<input
						type="checkbox"
						class="toggle toggle-primary toggle-sm"
						bind:checked={silentMode}
					/>
				</label>
			{/if}
			<button
				class="btn w-full btn-primary md:w-38"
				type="submit"
				disabled={submitting || blockSubmit}
				title={blockSubmit ? "Corrigez les champs en erreur avant d'envoyer" : undefined}
			>
				{submitting ? 'Enregistrement…' : 'Modifier le jeu'}
			</button>
		</div>
	</form>
</div>
