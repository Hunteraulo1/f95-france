<script lang="ts">
import type { FormGameType } from '$lib/types';
import { Copy, Link2, Link2Off } from '@lucide/svelte';
import type { Snippet } from 'svelte';
import type { ChangeEventHandler, HTMLInputAttributes } from 'svelte/elements';

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
}

const { title, className, active, step, name, type, children, attributes, game = $bindable() }: Props = $props();

if (!game) throw new Error('no game data');

let error = $state(false);

const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
  if (name === 'ac' && event.currentTarget instanceof HTMLInputElement) {
    game.ac = event.currentTarget.checked;
    return;
  }

  const gameId = game.threadId;

  if (name === 'id' && gameId && gameId !== 0) {
    switch (game.website) {
      case 'f95z':
        game.link = `https://f95zone.to/threads/${gameId}`;
        break;
      case 'lc':
        game.link = `https://lewdcorner.com/threads/${gameId}`;
        break;
    }
  }

  const value = event.currentTarget.value;

  if (type === 'number') {
    (game[name] as number) = Number.parseInt(value);
  } else {
    (game[name] as string) = value;
  }
};

const handleInput: ChangeEventHandler<HTMLInputElement> = (event) => {
  if (name === 'ac' || name === 'id') return;

  // Validation simplifiée pour l'instant
  error = false;
};
</script>

<div class={className} class:hidden={!step || !active?.includes(step)}>
  <label for={name}>{title}:</label>
  <div class="flex gap-1">
    <input
      placeholder={title}
      id={name}
      onchange={handleChange}
      oninput={handleInput}
      disabled={(name === 'tlink' && game.tname === 'integrated') || (name === 'ac' && game.website !== 'f95z') || (name === 'id' && game.website === 'other') || (name === 'tversion' && game.tname === 'integrated') || (name === 'tlink' && game.tname === 'no_translation') || (name === 'tversion' && game.tname === 'no_translation')}
      bind:value={game[name]}
      {type}
      class={type === "checkbox" ? "checkbox checkbox-lg" : "input input-bordered w-full"}
      class:border-error={error}
      {...attributes}
    />
    {#if name === 'tversion'}
      <button
        class="btn w-min"
        class:btn-disable={!game.version}
        class:btn-primary={game.version}
        disabled={game.tname === 'integrated' && name === 'tversion'}
        onclick={(e) => {
          e.preventDefault();
          if (game.version) game.tversion = game.version;
        }}>
        <Copy size="1rem" />
    </button>
    {:else if name === 'link'}
      <a
        href={game.link}
        target="_blank"
        class="btn w-min"
        class:btn-disable={!game.link}
        class:btn-primary={game.link}>
        {#if game.link}
          <Link2 size="1rem" />
        {:else}
          <Link2Off size="1rem" />
        {/if}
      </a>
    {:else if name === 'tlink'}
      <a
        href={game.tlink}
        target="_blank"
        class="btn w-min"
        class:btn-disable={!game.tlink}
        class:btn-primary={game.tlink}>
        {#if game.tlink}
          <Link2 size="1rem" />
        {:else}
          <Link2Off size="1rem" />
        {/if}
      </a>
    {/if}
    {@render children?.()}
  </div>
</div>
