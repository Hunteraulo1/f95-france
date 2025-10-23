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
  step?: number;
  data: PageData;
}

const isLoading = writable<boolean>(false);

let { step = $bindable(0), data }: Props = $props();

const translators = $state(data.traductors);

// State locale pour le jeu
let game = $state<FormGameType>({
  // Game fields
  id: '',
  name: '',
  tags: '',
  type: '',
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
  tname: 'Traduction',
  tlink: '',
  translatorId: null,
  proofreaderId: null,
  ttype: 'manual',
  ac: false
});

let silentMode = $state(false);
let scraping = $state(false);

const isAdmin = checkRole(['admin', 'superadmin']);

const changeStep = (amount: number): void => {
  if (step + amount >= 0 && step + amount <= 5) {
    step += amount;
  }
};

const scrapeData = async ({ threadId, website }: { threadId: number; website: FormGameType['website'] }): Promise<void> => {
  // try {
  //   scraping = true;
  //   const result = await GAS_API.getScrape({ id: threadId, domain: website });

  //   game = {
  //     ...game,
  //     name: result.name ?? game.name,
  //     tags: result.tags ?? game.tags,
  //     type: result.type ?? game.type,
  //     image: result.image ?? game.image,
  //   };
  // } catch (error) {
  //   console.error('Error scrapped game', error);
  //   newToast({
  //     alertType: 'error',
  //     message: 'Impossible de récupérer les informations du jeu',
  //   });
  // } finally {
  //   scraping = false;
  // }
};

const handleSubmit = async (): Promise<void> => {
  $isLoading = true;

  try {
    // const result = await GAS_API.postGame({ game, silentMode });

    // if (result === 'duplicate') {
    //   newToast({
    //     alertType: 'warning',
    //     message: 'Le jeu existe déjà dans la liste',
    //   });
    //   return;
    // }

    goto('/');
    newToast({
      alertType: 'success',
      message: 'Le jeu a bien été ajouté',
    });
  } catch (error) {
    console.error('Error adding game', error);
    newToast({
      alertType: 'error',
      message: "Impossible d'ajouter le jeu",
    });
  } finally {
    $isLoading = false;
  }
};

type Element = {
  Component: typeof Select | typeof Input | typeof Textarea | typeof Datalist | typeof InputImage | typeof Checkbox;
  type?: HTMLInputElement['type'];
  values?: string[];
  title: string;
  className?: string;
  active?: number[];
  name: keyof FormGameType & string;
};

const elements: Element[] = [
  {
    Component: Select,
    active: [0, 5],
    title: 'Platforme',
    name: 'website',
    values: ['f95z', 'lc', 'other'],
  },
  {
    Component: Input,
    active: [1, 5],
    title: 'ID du thread',
    name: 'threadId',
    type: 'number',
  },
  {
    Component: Input,
    active: [2, 5],
    title: 'Nom du jeu',
    name: 'name',
    type: 'text',
  },
  {
    Component: Input,
    active: [2, 5],
    title: 'Lien du jeu',
    name: 'link',
    type: 'text',
  },
  {
    Component: Textarea,
    active: [2, 5],
    title: 'Tags du jeu',
    name: 'tags',
  },
  {
    Component: Input,
    active: [2, 5],
    title: 'Type du jeu',
    name: 'type',
    type: 'text',
  },
  {
    Component: InputImage,
    active: [2, 5],
    title: "Lien de l'image du jeu",
    name: 'image',
  },
  {
    Component: Textarea,
    active: [2, 5],
    title: 'Description du jeu',
    name: 'description',
  },
];
</script>

{#if !$isLoading}
  <div class="mt-0 flex flex-col items-center justify-center gap-4 w-full">
    <form
      class="relative flex w-full flex-col items-center"
      onsubmit={handleSubmit}
      autocomplete="off"
    >
      {#if scraping}
        <div class="lg:absolute flex items-center gap-1 left-0">
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
              onchange={() => {silentMode = !silentMode}}
            />
          </label>
        </div>
      {/if}
      <div
        class="grid w-full grid-cols-1 gap-8 p-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        {#each elements as { Component, name, title, active, className, values, type }}
          <Component {step} {name} {title} {active} {className} {values} {type} {game} {translators} />
        {/each}
      </div>
      <div class="flex w-full flex-col justify-center gap-4 px-8 sm:flex-row">
        {#if step < 5}
          <button
            class="btn btn-outline btn-primary w-full sm:w-48"
            type="button"
            onclick={() => changeStep(-1)}
            disabled={step <= 0}>
            Précédent
          </button>
          <button
            class="btn btn-primary w-full sm:w-48"
            type="button"
            onclick={() => changeStep(1)}>
            Suivant
          </button>
        {:else}
          <button class="btn btn-primary w-full sm:w-48" type="submit">
            Ajouter le jeu
          </button>
        {/if}
        {#if checkRole(['superadmin'])}
          <Dev {step} {game} />
          <!-- <Dev {step} {scrapeData} {game} /> -->
        {/if}
        {#if game.website === "lc" || game.website === "f95z"}
          <Insert {game} />
        {/if}
      </div>
    </form>
  </div>
{/if}
