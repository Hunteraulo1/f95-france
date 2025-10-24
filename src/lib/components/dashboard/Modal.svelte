<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
  showModal: boolean;
  title: string;
  modalContent?: Snippet;
  modalAction?: Snippet;
}

let { showModal = $bindable(), title, modalContent, modalAction }: Props = $props();
</script>

{#if showModal}
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg">{title}</h3>
      {#if modalContent}
        {@render modalContent()}
      {/if}
      <div class="modal-action">
        {#if modalAction}
          {@render modalAction()}
        {/if}
        <button class="btn" onclick={() => { showModal = false }}>Fermer</button>
      </div>
    </div>
  </div>
{/if}
