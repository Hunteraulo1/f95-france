<script lang="ts">
	import type { FormGameType } from '$lib/types';

	interface Props {
		game: FormGameType;
		/** Étape courante du formulaire (0 = Site, 2 = Infos jeu, …). */
		step: number;
		onDevDataApplied?: () => void;
		onForceScrape?: () => void | Promise<void>;
	}

	let { game = $bindable(), step, onDevDataApplied, onForceScrape }: Props = $props();

	const showForceScrape = $derived(
		step >= 2 &&
			(game.website === 'f95z' || game.website === 'lc') &&
			typeof onForceScrape === 'function'
	);

	const handleClick = (): void => {
		game = {
			...game,
			website: 'other',
			threadId: null,
			name: 'TEST GAME FOR DEV',
			link: 'https://testgame.dev',
			status: 'abandoned',
			tags: 'no sexual content',
			description: 'TEST, DEV, NE PAS TOUCHER',
			gameType: 'renpy',
			gameVersion: 'v666',
			version: 'v666',
			tversion: 'v42',
			tname: 'translation',
			translationName: 'test translation',
			tlink: 'https://testgame.dev/translation',
			translatorId: 'Hunteraulo',
			proofreaderId: 'Rory-Mercury91',
			ttype: 'hs',
			gameAutoCheck: false,
			ac: false,
			image: 'https://attachments.f95zone.to/2024/04/3572650_Remaster_HD.png'
		};
		onDevDataApplied?.();
	};
</script>

<button class="btn w-full btn-info md:w-38" type="button" onclick={handleClick}> Dev data </button>

{#if showForceScrape}
	<button class="btn w-full btn-info md:w-38" type="button" onclick={() => void onForceScrape?.()}>
		Force scrape
	</button>
{/if}
