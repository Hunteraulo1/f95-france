<script lang="ts">
	import { enhance } from '$app/forms';
	import type { User } from '$lib/server/db/schema';
	import { loadUserData, user } from '$lib/stores';
	import { checkRole } from '$lib/utils';

	let users = $state<User[]>([]);
	let profileError = $state<string | null>(null);
	let themeError = $state<string | null>(null);

	$effect(() => {
		if ($user && checkRole(['superadmin'])) {
			users = [$user as User] // TODO: Get users from database
		}
	});

	const themes: Record<User['theme'], string> = {
		light: 'Clair',
		dark: 'Sombre',
	};
</script>

<section class="flex flex-col gap-8">
  <div class="flex flex-col gap-4">
    <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-200">Informations de profil</h2>
  
    <div class="card bg-base-100 shadow-sm p-8 items-center justify-between gap-4 w-full">
      {#if profileError}
        <div class="alert alert-error mb-4">
          <span>{profileError}</span>
        </div>
      {/if}

      <form method="POST" action="?/updateProfile" use:enhance={() => {
        profileError = null;
        return async ({ result, update }) => {
          if (result.type === 'success') {
            await update();
            await loadUserData(); // Recharger les données utilisateur
            profileError = null;
          } else if (result.type === 'failure' && result.data) {
            const message = typeof result.data === 'object' && 'message' in result.data 
              ? String(result.data.message) 
              : 'Erreur lors de la mise à jour';
            profileError = message;
          }
        };
      }}>
        <div class="flex items-center justify-between gap-4 w-full mb-4">
          <span class="opacity-70">Les informations dans cette section sont affichées sur votre page de profil.</span>
        </div>
        <div class="flex flex-col md:flex-row items-center justify-between gap-4 w-full">
          <label class="input w-full flex">
            Pseudo
            <input 
              type="text" 
              name="username"
              class="grow ring-0" 
              placeholder="Pseudo" 
              value={$user?.username || ''}
              required
            />
          </label>
          <label class="input w-full flex">
            Photo de profil
            <input 
              type="url" 
              name="avatar"
              class="grow ring-0" 
              placeholder="monlien.com/photo.jpg" 
              value={$user?.avatar || ''}
            />
          </label>
        </div>
        <div class="flex justify-end mt-4">
          <button type="submit" class="btn btn-primary">
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  </div>
  
  <div class="flex flex-col gap-4">
    <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-200">Préférences utilisateur</h2>
  
    <div class="card bg-base-100 shadow-sm p-8 items-center justify-between gap-4 w-full">
      {#if themeError}
        <div class="alert alert-error mb-4">
          <span>{themeError}</span>
        </div>
      {/if}

      <form method="POST" action="?/updateTheme" use:enhance={() => {
        themeError = null;
        return async ({ result, update }) => {
          if (result.type === 'success') {
            await update();
            await loadUserData(); // Recharger les données utilisateur
            // Appliquer le thème immédiatement et sauvegarder dans localStorage
            if (typeof document !== 'undefined' && typeof localStorage !== 'undefined' && $user?.theme) {
              document.documentElement.setAttribute('data-theme', $user.theme);
              localStorage.setItem('theme', $user.theme);
            }
            themeError = null;
          } else if (result.type === 'failure' && result.data) {
            const message = typeof result.data === 'object' && 'message' in result.data 
              ? String(result.data.message) 
              : 'Erreur lors de la mise à jour';
            themeError = message;
          }
        };
      }}>
        <div class="flex items-center justify-between gap-4 w-full mb-4">
          <span class="opacity-70">Les informations dans cette section sont affichées sur votre page de profil.</span>
        </div>
        <div class="flex flex-col md:flex-row items-center justify-between gap-4 w-full">
          <label class="input w-full flex box-content">
            Thème
            <select
              name="theme"
              class="select grow ring-0 bg-base-100 py-1 text-slate-900 h-[calc(100%-2px)] dark:text-slate-200 outline-none select-ghost"
              value={$user?.theme || 'light'}
              required
              onchange={(e) => {
                const form = e.currentTarget.closest('form');
                if (form) {
                  form.requestSubmit();
                }
              }}
            >
              {#each Object.keys(themes) as theme}
                <option value={theme}>{themes[theme as User['theme']]}</option>
              {/each}
            </select>
          </label>
        </div>
      </form>
    </div>
  </div>
  
  {#if $user && checkRole(['superadmin'])}
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
