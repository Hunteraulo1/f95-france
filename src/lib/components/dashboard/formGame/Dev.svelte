<script lang="ts">
	import type { FormGameType } from '$lib/types';

	interface Props {
		game: FormGameType;
		// scrapeData: (args: ScrapeDataArgs) => Promise<void>;
	}

	let { game = $bindable() }: Props = $props();

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
			type: 'other',
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
	};
</script>

<button class="btn w-full btn-info sm:w-48" type="button" onclick={handleClick}> Dev data </button>

{#if game && game.website === 'f95z'}
	<button
		class="btn w-full btn-info sm:w-48"
		type="button"
		onclick={() => {
			if (!game) throw new Error('no game data');

			// scrapeData({ id: game.id, website: 'f95z' })
		}}
	>
		Force scrape
	</button>
{/if}
