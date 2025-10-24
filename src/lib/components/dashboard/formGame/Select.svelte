<script lang="ts">
	import type { FormGameType } from '$lib/types';
	import type { ChangeEventHandler } from 'svelte/elements';

interface Props {
  values?: Array<FormGameType[keyof FormGameType]>;
  title: string;
  className?: string;
  active?: number[];
  step?: number;
  name: keyof FormGameType;
  game: FormGameType;
}

const { title, values = [], className, active, step, name, game = $bindable() }: Props = $props();

if (!game) throw new Error('no game data');

const handleChange: ChangeEventHandler<HTMLSelectElement> = (event) => {
  if (name === 'tname' && event.currentTarget.value === 'Pas de traduction') {
    game.tversion = '';
    game.tlink = '';
  }

  if (name === 'tname' && event.currentTarget.value === 'Intégrée') {
    game.tversion = 'Intégrée';
    game.tlink = '';

    console.info('handleChange ~ game:', game);

    return;
  }

  (game[name] as FormGameType[keyof FormGameType]) = event.currentTarget.value;

  if (name === 'website') {
    if (game.website !== 'f95z') game.ac = false;

    const gameId = game.threadId;

    if (!gameId || gameId === 0) return;

    switch (game.website) {
      case 'f95z':
        game.link = `https://f95zone.to/threads/${gameId}`;
        break;
      case 'lc':
        game.link = `https://lewdcorner.com/threads/${gameId}`;
        break;
    }
  }
};
</script>

<div class={className} class:hidden={step !== undefined && !active?.includes(step)}>
  <label for={name}>{title}:</label>
  <select
    placeholder={title}
    id={name}
    onchange={handleChange}
    bind:value={game[name]}
    class="select select-bordered w-full"
    class:border-error={game[name] === ''}
    >
    {#each Object.values(values) as value}
      <option>{value}</option>
    {/each}
  </select>
</div>
