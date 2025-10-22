<script lang="ts">
	import type { User } from '$lib/server/db/schema';
	import { user } from '$lib/stores';
	import { checkRole } from '$lib/utils';

  let users: User[] = []

  if (checkRole($user.role, ['superadmin'])) {
    users = [$user] // TODO: Get users from database
  }
</script>

<section class="flex flex-col gap-8">
  <div class="flex flex-col gap-4">
    <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-200">Informations de profil</h2>
  
    <div class="card bg-base-100 shadow-sm p-8 items-center justify-between gap-4 w-full">
      <div class="flex items-center justify-between gap-4 w-full">
        <span class="opacity-70">Les informations dans cette section sont affichées sur votre page de profil.</span>
      </div>
      <div class="flex flex-col md:flex-row items-center justify-between gap-4 w-full">
        <label class="input w-full flex">
          Pseudo
          <input type="text" class="grow ring-0" placeholder="Pseudo" />
        </label>
        <label class="input w-full flex">
          Photo de profil
          <input type="text" class="grow ring-0" placeholder="monlien.com/photo.jpg" />
        </label>
      </div>
    </div>
  </div>
  
  <div class="flex flex-col gap-4">
    <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-200">Préférences utilisateur</h2>
  
    <div class="card bg-base-100 shadow-sm p-8 items-center justify-between gap-4 w-full">
      <div class="flex items-center justify-between gap-4 w-full">
        <span class="opacity-70">Les informations dans cette section sont affichées sur votre page de profil.</span>
      </div>
      <div class="flex flex-col md:flex-row items-center justify-between gap-4 w-full">
        <label class="input w-full flex box-content">
          Thème
          <select class="select grow ring-0 bg-base-100 py-1 text-slate-900 h-[calc(100%-2px)] dark:text-slate-200 outline-none select-ghost">
              <option value="emerald">Clair</option>
            <option value="dark">Sombre</option>
          </select>
        </label>
      </div>
    </div>
  </div>
  
  {#if checkRole($user.role, ['superadmin'])}
    <div class="flex flex-col gap-4">
      <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-200">Changer d'utilisateur (Dev)</h2>
    
      <div class="card bg-base-100 shadow-sm p-8 items-center justify-between gap-4 w-full">
        <div class="flex items-center justify-between gap-4 w-full">
          <span class="opacity-70">Fonctionnalité permettant d'utiliser un autre compte utilisateur.</span>
        </div>
        <div class="flex flex-col md:flex-row items-center justify-between gap-4 w-full">
          <label class="input w-full flex box-content">
            Utilisateur
            <select class="select grow ring-0 bg-base-100 py-1 text-slate-900 h-[calc(100%-2px)] dark:text-slate-200 outline-none select-ghost">
              {#each users as user }
                <option value="user.id">{user.username}</option>
              {/each}
            </select>
          </label>
        </div>
      </div>
    </div>
  {/if}
</section>
