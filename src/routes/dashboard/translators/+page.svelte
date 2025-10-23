<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();
  
  let searchQuery = $state('');
  
  let filteredTraductors = $derived.by(() => 
    data.traductors.filter(traductor => 
      traductor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (traductor.discordId && traductor.discordId.toString().includes(searchQuery))
    )
  );
  
  let showAddModal = $state(false);
  let showEditModal = $state(false);
  let selectedTraductor: any = $state(null);
  
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
    selectedTraductor = null;
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
      {#each filteredTraductors as traductor, index (traductor.id)}
        <tr>
          <td class="font-bold">{index + 1}</td>
          <th class="font-bold">{traductor.name}</th>
          <td>{traductor.discordId || 'N/A'}</td>
          <td>
            {#each traductor.pages as {name, link}}
              <a href={link} target="_blank" class="badge badge-outline mr-2">{name}</a>
            {/each}
          </td>
          <td>
            <button 
              class="btn btn-primary btn-sm"
              onclick={() => {
                selectedTraductor = traductor;
                initializePagesForEdit(traductor);
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
          <input type="hidden" name="pages" value={JSON.stringify(pages)} />
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
{#if showEditModal && selectedTraductor}
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
        <input type="hidden" name="id" value={selectedTraductor.id} />
        <div class="form-control w-full">
          <label for="edit-name" class="label">
            <span class="label-text">Nom du traducteur</span>
          </label>
          <input 
            id="edit-name"
            type="text" 
            name="name" 
            class="input input-bordered w-full" 
            value={selectedTraductor.name}
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
            value={selectedTraductor.discordId || ''}
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
          <input type="hidden" name="pages" value={JSON.stringify(pages)} />
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
