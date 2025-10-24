<script lang="ts">
	import type { Translator } from '$lib/server/db/schema';

interface Props {
  showModal: boolean;
  name: string;
  translators: Translator[];
}

let { showModal = $bindable(), name, translators = $bindable() }: Props = $props();

let newTranslatorName = $state<Translator['name']>();

const addTraductor = async () => {
  if (newTranslatorName) {
    try {
      const response = await fetch('/api/traductors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: newTranslatorName })
      });
      
      if (response.ok) {
        const result = await response.json();
        // Recharger la liste complète depuis l'API
        const getResponse = await fetch('/api/traductors');
        translators = await getResponse.json();
        newTranslatorName = '';
        showModal = false;
      } else {
        console.error('Error creating translator');
      }
    } catch (error) {
      console.error('Error creating translator:', error);
    }
  }
};
</script>

{#if showModal}
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg">Ajouter un traducteur</h3>
      <div class="form-control">
        <label class="label" for="newTranslatorName">
          <span class="label-text">Nom du traducteur</span>
        </label>
        <input
          type="text"
          placeholder="Nom du traducteur"
          class="input input-bordered w-full"
          bind:value={newTranslatorName}
        />
      </div>
      <div class="modal-action">
        <button class="btn btn-primary" onclick={addTraductor}>Ajouter</button>
        <button class="btn" onclick={() => { showModal = false }}>Annuler</button>
      </div>
    </div>
  </div>
{/if}
