<script lang="ts">
import AddTraductorModal from '$lib/components/AddTraductorModal.svelte';
import type { Translator } from '$lib/server/db/schema';
import type { FormGameType } from '$lib/types';
import { checkRole } from '$lib/utils';

import { UserPlus } from '@lucide/svelte';
import type { ChangeEventHandler, HTMLInputAttributes } from 'svelte/elements';

interface Props extends HTMLInputAttributes {
  title: string;
  className?: string;
  active?: number[];
  step?: number;
  name: keyof FormGameType;
  game: FormGameType;
  translators: Translator[];
}

const { title, className, active, step, name, game = $bindable(), translators = $bindable() }: Props = $props();

if (!game) throw new Error('no game data');

const isTraductor = checkRole(['translator']);

const handleWarning = (value: string): boolean => {
  if (isTraductor || game[name] === '') return false;

  return !translators.find((item) => item.name === value);
};

const handleError = (): boolean => {
  if (game.translatorId === '') return false;

  return game.translatorId === game.proofreaderId;
};

let warning = $state(handleWarning(game[name] as string));
let error = $state(handleError());

const handleChange: ChangeEventHandler<HTMLInputElement> = (event): void => {
  const value = event.currentTarget.value;

  (game[name] as string) = value;
};

const handleInput: ChangeEventHandler<HTMLInputElement> = (event): void => {
  warning = handleWarning(event.currentTarget.value);
  error = handleError();
};

let modal = $state(false);
</script>

<div class={className} class:hidden={!step || !active?.includes(step)}>
  <label for={name}>{title}:</label>
  <div class="flex gap-1">
    <input
      placeholder={title}
      type="search"
      id={name}
      list="traductor-list"
      disabled={translators.length === 0}
      onchange={handleChange}
      oninput={handleInput}
      bind:value={game[name]}
      class="input input-bordered w-full"
      class:input-warning={warning}
      class:input-error={error}
    />
    <datalist id="traductor-list">
      {#each translators as item}
        <option>{item.name}</option>
      {/each}
    </datalist>
    {#if checkRole(['admin', 'superadmin'])}
      <button
        class="btn btn-primary w-min"
        onclick={(e) => {
          e.preventDefault();
          modal = true;
        }}>
        <UserPlus size="1rem" />
      </button>
    {/if}
  </div>
</div>

<AddTraductorModal
  bind:showModal={modal}
  name={game.translatorId ?? ''}
  {translators}
/>
