<script lang="ts">
	import type { FormGameType } from '$lib/types';
	import { gameAutoCheckEnabledForWebsite } from '$lib/utils/game-auto-check';
	import { isIntegrated, isNoTranslation } from '$lib/utils/game-form-validation';
	import { isValidRequiredHttpUrl } from '$lib/utils/link-validation';
	import Copy from '@lucide/svelte/icons/copy';
	import Link2 from '@lucide/svelte/icons/link-2';
	import Link2Off from '@lucide/svelte/icons/link-2-off';
	import type { Snippet } from 'svelte';
	import type { ChangeEventHandler, FocusEventHandler, HTMLInputAttributes } from 'svelte/elements';

	interface Props {
		title: string;
		className?: string;
		active?: number[];
		step?: number;
		name: keyof FormGameType;
		type?: HTMLInputElement['type'];
		children?: Snippet;
		attributes?: HTMLInputAttributes;
		game: FormGameType;
		invalid?: boolean;
		warn?: boolean;
		/** Appelé au blur après synchro (ex. ID thread : vérif doublon + scrape) */
		onBlurCommit?: (name: keyof FormGameType) => void | Promise<void>;
	}

	const {
		title,
		className,
		active,
		step,
		name,
		type,
		children,
		attributes,
		game = $bindable(),
		invalid = false,
		warn = false,
		onBlurCommit
	}: Props = $props();

	if (!game) throw new Error('no game data');

	const updateGameLink = () => {
		const gameId = game.threadId;

		if (!gameId || gameId === 0) {
			game.link = '';
			return;
		}

		switch (game.website) {
			case 'f95z':
				game.link = `https://f95zone.to/threads/${gameId}`;
				break;
			case 'lc':
				game.link = `https://lewdcorner.com/threads/${gameId}`;
				break;
			default:
				game.link = '';
				break;
		}
	};

	const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
		if (name === 'ac' && event.currentTarget instanceof HTMLInputElement) {
			game.ac = event.currentTarget.checked;
			return;
		}

		const value = event.currentTarget.value;

		if (type === 'number') {
			const parsed = Number.parseInt(value, 10);
			(game[name] as number | null) = Number.isNaN(parsed) ? null : parsed;
		} else {
			(game[name] as string) = value;
		}

		if (name === 'threadId') {
			updateGameLink();
		}
	};

	const handleBlur: FocusEventHandler<HTMLInputElement> = async (event) => {
		if (name === 'threadId') {
			updateGameLink();
		}
		await onBlurCommit?.(name);
		attributes?.onblur?.(event);
	};

	/** Réactif : sinon disabled reste figé après changement de statut de traduction */
	let tlinkLocked = $derived(isIntegrated(game.tname) || isNoTranslation(game.tname));
	let tversionLocked = $derived(isIntegrated(game.tname) || isNoTranslation(game.tname));
	/** f95z / lc : lien du jeu imposé par l’ID de thread */
	let gameLinkLocked = $derived(game.website === 'f95z' || game.website === 'lc');
</script>

<div class={className} class:hidden={!step || !active?.includes(step)}>
	<div class="flex items-center gap-2">
		<label for={name}>{title}:</label>
		{#if name === 'translationName'}
			<div class="tooltip tooltip-right" data-tip="Exemple : Saison 1">
				<button
					type="button"
					class="btn btn-circle btn-ghost btn-xs"
					aria-label="Aide nom de la traduction"
				>
					?
				</button>
			</div>
		{/if}
		{#if name === 'version'}
			<div
				class="tooltip tooltip-right"
				data-tip="Version de référence = dernière version sortie du jeu pour la branche concernée (pas la version de la traduction). Exemple : s'il y a une saison 1 et une saison 2, pour une traduction de la saison 1, indique la dernière version de la saison 1."
			>
				<button
					type="button"
					class="btn btn-circle btn-ghost btn-xs"
					aria-label="Aide version de référence"
				>
					?
				</button>
			</div>
		{/if}
	</div>
	<div class="flex gap-1">
		<input
			{...attributes}
			placeholder={title}
			id={name}
			onchange={handleChange}
			oninput={handleChange}
			onblur={handleBlur}
			disabled={(name === 'link' && gameLinkLocked) ||
				(name === 'tlink' && tlinkLocked) ||
				(name === 'ac' &&
					(!gameAutoCheckEnabledForWebsite(game.website) || game.gameAutoCheck === false)) ||
				(name === 'threadId' && game.website === 'other') ||
				(name === 'tversion' && tversionLocked)}
			bind:value={game[name]}
			{type}
			class={type === 'checkbox' ? 'checkbox checkbox-lg' : 'input-bordered input mt-1 w-full'}
			class:input-error={invalid}
			class:input-warning={warn}
		/>
		{#if name === 'tversion'}
			<button
				class="btn mt-1 w-min"
				class:btn-disable={!game.gameVersion}
				class:btn-primary={!!game.gameVersion}
				disabled={tversionLocked}
				onclick={(e) => {
					e.preventDefault();
					const gv = game.gameVersion;
					if (gv != null && String(gv).trim()) game.tversion = String(gv).trim();
				}}
			>
				<Copy size="1rem" />
			</button>
		{:else if name === 'version'}
			<button
				class="btn mt-1 w-min"
				class:btn-disable={!game.gameVersion}
				class:btn-primary={!!game.gameVersion}
				type="button"
				onclick={(e) => {
					e.preventDefault();
					const gv = game.gameVersion;
					if (gv != null && String(gv).trim()) game.version = String(gv).trim();
				}}
			>
				<Copy size="1rem" />
			</button>
		{:else if name === 'link'}
			{@const gameLinkHref = typeof game.link === 'string' ? game.link.trim() : ''}
			{#if gameLinkHref && isValidRequiredHttpUrl(gameLinkHref)}
				<a
					href={gameLinkHref}
					target="_blank"
					rel="noopener noreferrer"
					class="btn mt-1 w-min btn-primary"
					aria-label="Ouvrir le lien du jeu"
				>
					<Link2 size="1rem" />
				</a>
			{:else}
				<button
					type="button"
					class="btn-disable btn mt-1 w-min"
					disabled
					aria-label="Lien du jeu indisponible"
				>
					<Link2Off size="1rem" />
				</button>
			{/if}
		{:else if name === 'tlink'}
			{@const translationLinkHref = typeof game.tlink === 'string' ? game.tlink.trim() : ''}
			{#if translationLinkHref && isValidRequiredHttpUrl(translationLinkHref)}
				<a
					href={translationLinkHref}
					target="_blank"
					rel="noopener noreferrer"
					class="btn mt-1 w-min btn-primary"
					aria-label="Ouvrir le lien de traduction"
				>
					<Link2 size="1rem" />
				</a>
			{:else}
				<button
					type="button"
					class="btn-disable btn mt-1 w-min"
					disabled
					aria-label="Lien de traduction indisponible"
				>
					<Link2Off size="1rem" />
				</button>
			{/if}
		{/if}
		{@render children?.()}
	</div>
</div>
