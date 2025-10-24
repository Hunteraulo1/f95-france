<script lang="ts">
	import type { FormGameType } from '$lib/types';


interface ScrapeDataArgs {
  threadId: FormGameType['threadId'];
  website: Extract<FormGameType['website'], 'f95z'>;
}

interface Props {
  step: number;
  game: FormGameType;
  // scrapeData: (args: ScrapeDataArgs) => Promise<void>;
}

let { step, game = $bindable() }: Props = $props();

const handleClick = (): void => {
  step = 5;
  game = {
    ...game,
    website: 'other',
    threadId: 666,
    name: 'TEST GAME FOR DEV',
    link: 'https://testgame.dev',
    status: 'abandoned',
    tags: 'TEST, DEV, NE PAS TOUCHER',
    type: 'Autre',
    version: 'v666',
    tversion: 'n/a',
    tname: 'Pas de traduction',
    tlink: 'https://traduction.dev',
    translatorId: 'Hunteraulo',
    proofreaderId: 'Hunteraulo',
    ttype: 'to_tested',
    ac: false,
    image: 'https://attachments.f95zone.to/2024/04/3572650_Remaster_HD.png',
  };
};
</script>

<button
  class="btn btn-info w-full sm:w-48"
  type="button"
  onclick={handleClick}>
  Dev data
</button>

{#if game && game.website === "f95z"}
  <button
    class="btn btn-info w-full sm:w-48"
    type="button"
    onclick={() => {
      if (!game) throw new Error('no game data');
      
      // scrapeData({ id: game.id, website: 'f95z' })
    }}>
    Force scrape
  </button>
{/if}
