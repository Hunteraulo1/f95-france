<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();
  
  let searchQuery = $state('');
  
  let filteredTranslators = $derived.by(() => 
    data.translator.filter(traductor => 
      traductor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (traductor.discordId && traductor.discordId.toString().includes(searchQuery))
    )
  );
  
  let showAddModal = $state(false);
  let showEditModal = $state(false);
  let selectedTranslator: any = $state(null);
  
  let pages = $state([{ name: '', link: '' }]);
  
  const addPage = () => {
    pages = [...pages, { name: '', link: '' }];
  };
  
  const removePage = (index: number) => {
    if (pages.length > 1) {
      pages = pages.filter((_, i) => i !== index);
    }
  };
  
  const initializePagesForEdit = (traductor: any) => {
    if (traductor.pages && Array.isArray(traductor.pages)) {
      pages = traductor.pages.length > 0 ? traductor.pages : [{ name: '', link: '' }];
    } else {
      pages = [{ name: '', link: '' }];
    }
  };

  const handleEditSuccess = () => {
    showEditModal = false;
    selectedTranslator = null;
  };
</script>

<div class="flex gap-2 justify-end w-full">
  <input 
    type="text" 
    class="input input-bordered" 
    placeholder="Rechercher un traducteur" 
    bind:value={searchQuery}
  />
  <button 
    class="btn btn-primary"
    onclick={() => showAddModal = true}
  >
    Ajouter un traducteur
  </button>
</div>

<div class="overflow-x-auto">
  <table class="table">
    <!-- head -->
    <thead>
      <tr>
        <th></th>
        <th>Traductors/Relecteurs</th>
        <th>ID Discord</th>
        <th>Pages</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody>
      {#each filteredTranslators as translator, index (translator.id)}
        <tr>
          <td class="font-bold">{index + 1}</td>
          <th
            class="font-bold"
            class:cursor-pointer={translator.userId}
            class:hover:text-primary={translator.userId}
            onclick={() => {
            if (translator.userId) {
              goto(`/dashboard/profile/${translator.userId}`);
            }
          }}>{translator.name}</th>
          {#if translator.discordId}
            <td>
              {translator.discordId}
            </td>
          {:else}
            <td class="text-gray-500">
              N/A
            </td>
          {/if}
          <td>
            {#each translator.pages as {name, link}}
              <a href={link} target="_blank" class="badge badge-outline mr-2 hover:text-primary">{name}</a>
            {/each}
          </td>
          <td>
            <button 
              class="btn btn-primary btn-sm"
              onclick={() => {
                selectedTranslator = translator;
                initializePagesForEdit(translator);
                showEditModal = true;
              }}
            >
              Modifier
            </button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<!-- Modal d'ajout de traducteur -->
{#if showAddModal}
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg">Ajouter un traducteur</h3>
      <form method="POST" action="?/addTranslator" use:enhance>
        <div class="form-control w-full">
          <label for="add-name" class="label">
            <span class="label-text">Nom du traducteur</span>
          </label>
          <input 
            id="add-name"
            type="text" 
            name="name" 
            class="input input-bordered w-full" 
            required 
          />
        </div>
        <div class="form-control w-full">
          <label for="add-discord" class="label">
            <span class="label-text">ID Discord</span>
          </label>
          <input 
            id="add-discord"
            type="number" 
            name="discordId" 
            class="input input-bordered w-full" 
          />
        </div>
        <div class="form-control w-full">
          <label class="label" for="pages">
            <span class="label-text">Pages</span>
          </label>
          <div class="space-y-2">
            {#each pages as page, index}
              <div class="flex gap-2 items-center">
                <input 
                  type="text" 
                  placeholder="Nom de la page"
                  class="input input-bordered flex-1"
                  bind:value={page.name}
                />
                <input 
                  type="url" 
                  placeholder="Lien"
                  class="input input-bordered flex-1"
                  bind:value={page.link}
                />
                {#if pages.length > 1}
                  <button 
                    type="button" 
                    class="btn btn-error btn-sm"
                    onclick={() => removePage(index)}
                  >
                    ✕
                  </button>
                {/if}
              </div>
            {/each}
            <button 
              type="button" 
              class="btn btn-outline btn-sm"
              onclick={addPage}
            >
              + Ajouter une page
            </button>
          </div>
          <input type="hidden" name="pages" value={JSON.stringify(pages.filter(page => page.name !== '' || page.link !== ''))} />
        </div>
        <div class="modal-action">
          <button type="button" class="btn" onclick={() => showAddModal = false}>
            Annuler
          </button>
          <button type="submit" class="btn btn-primary">
            Ajouter
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Modal d'édition de traducteur -->
{#if showEditModal && selectedTranslator}
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg">Modifier le traducteur</h3>
      <form method="POST" action="?/editTranslator" use:enhance={() => {
        return async ({ result, update }) => {
          if (result.type === 'success') {
            await update();
            handleEditSuccess();
          }
        };
      }}>
        <input type="hidden" name="id" value={selectedTranslator.id} />
        <div class="form-control w-full">
          <label for="edit-name" class="label">
            <span class="label-text">Nom du traducteur</span>
          </label>
          <input 
            id="edit-name"
            type="text" 
            name="name" 
            class="input input-bordered w-full" 
            value={selectedTranslator.name}
            required 
          />
        </div>
        <div class="form-control w-full">
          <label for="edit-discord" class="label">
            <span class="label-text">ID Discord</span>
          </label>
          <input 
            id="edit-discord"
            type="number" 
            name="discordId" 
            class="input input-bordered w-full" 
            value={selectedTranslator.discordId || ''}
          />
        </div>
        <div class="form-control w-full">
          <label class="label" for="pages">
            <span class="label-text">Pages</span>
          </label>
          <div class="space-y-2">
            {#each pages as page, index}
              <div class="flex gap-2 items-center">
                <input 
                  type="text" 
                  placeholder="Nom de la page"
                  class="input input-bordered flex-1"
                  bind:value={page.name}
                />
                <input 
                  type="url" 
                  placeholder="Lien"
                  class="input input-bordered flex-1"
                  bind:value={page.link}
                />
                {#if pages.length > 1}
                  <button 
                    type="button" 
                    class="btn btn-error btn-sm"
                    onclick={() => removePage(index)}
                  >
                    ✕
                  </button>
                {/if}
              </div>
            {/each}
            <button 
              type="button" 
              class="btn btn-outline btn-sm"
              onclick={addPage}
            >
              + Ajouter une page
            </button>
          </div>
          <input type="hidden" name="pages" value={JSON.stringify(pages.filter(page => page.name !== '' || page.link !== ''))} />
        </div>
        <div class="modal-action">
          <button type="button" class="btn" onclick={() => showEditModal = false}>
            Annuler
          </button>
          <button type="submit" class="btn btn-primary">
            Modifier
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
