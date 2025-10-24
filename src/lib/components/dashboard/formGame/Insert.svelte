<script lang="ts">
import { newToast } from '$lib/stores';
import type { FormGameType } from '$lib/types';
// import { ScrapeGame } from '$types/schemas';
import type { ChangeEventHandler } from 'svelte/elements';
import Modal from '../Modal.svelte';

interface Props {
  game: FormGameType;
}

const { game = $bindable() }: Props = $props();

let insertModal = $state(false);
let insertObject: string = $state('');
let isValid: boolean = $state(false);

const handleClickInsert = (): void => {
  if (!game) throw new Error('no game data');
  if (!insertObject) {
    newToast({
      alertType: 'warning',
      message: 'Veuillez entrer les données de LC Extractor',
    });

    return;
  }

  Object.assign(game, JSON.parse(insertObject));

  // game.ac = false; // Reload view data
};

const handleInput: ChangeEventHandler<HTMLTextAreaElement> = (e) => {
  // const validScrape = ScrapeGame.safeParse(JSON.parse(e.currentTarget.value));

  // isValid = validScrape.success;
};
</script>

<button
  class="btn btn-info w-full sm:w-48"
  type="button"
  onclick={() => { insertModal = true }}>
  Insert Data
</button>

<Modal bind:showModal={insertModal} title="Insérer les données du jeu">
  {#snippet modalContent()}
    <p>Le script fonctionne avec <a class="btn-link" href="https://www.tampermonkey.net">Tampermonkey</a></p>
    <a class="btn-link" target="_blank" href="https://github.com/Hunteraulo1/f95list-extractor/raw/refs/heads/main/dist/toolExtractor.user.js">Installer le script</a>
    
    <p class="py-4">Veuillez coller les données de LC Extractor ?</p>
    <textarea
      placeholder="Données de LC Extractor"
      class="textarea textarea-bordered max-h-32 w-full"
      oninput={handleInput}
      bind:value={insertObject}
    ></textarea>
  {/snippet}
  {#snippet modalAction()}
    <button onclick={handleClickInsert} disabled={!isValid} class="btn btn-info">
      Envoyer
    </button>
  {/snippet}
</Modal>
