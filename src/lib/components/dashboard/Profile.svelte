<script lang="ts">
	import type { User as UserType } from '$lib/server/db/schema';
	import type { PublicUser } from '$lib/types';
	import { CirclePlus, SquarePen, User } from '@lucide/svelte';
  interface Props {
    user: PublicUser | UserType | null;
    email?: UserType['email'] | null;
  }

  let { user, email }: Props = $props();

  const roles: Record<PublicUser['role'], string> = {
    'user': 'Utilisateur',
    'admin': 'Administrateur',
    'translator': 'Traducteur',
    'superadmin': 'Super Admin',
  }

</script>

<div class="flex gap-8">
	
	{#if user}
    <div class="flex flex-col gap-2">
      <div class="w-32 h-32 rounded-full bg-base-300 flex items-center justify-center p-4">
        {#if user.avatar && user.avatar !== ''}
          <img src={user.avatar} alt="Avatar de {user.username}" class="w-full h-full object-cover rounded-full" />
        {:else}
          <User size={64} />
        {/if}
      </div>
			<h3 class="text-lg font-semibold">{user.username}</h3>
      {#if email}
        <p>{email}</p>
      {/if}
			<span class="badge text-nowrap">{roles[user.role as keyof typeof roles]}</span>
      <p class="text-sm text-gray-500">
        Membre depuis: {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('fr-FR') : '—'}
      </p>
    </div>
    
    <div class="flex flex-col gap-4 w-full">
      <div class="stats shadow bg-base-100">
        <div class="stat">
          <div class="stat-figure text-primary">
            <CirclePlus />
          </div>
          <div class="stat-title">Total de jeu ajoutés</div>
          <div class="stat-value text-primary">{user.gameAdd}</div>
        </div>

        <div class="stat">
          <div class="stat-figure text-secondary">
            <SquarePen />
          </div>
          <div class="stat-title">Total de jeu modifiés</div>
          <div class="stat-value text-secondary">{user.gameEdit}</div>
        </div>
      </div>
      <div class="card bg-base-100 shadow-sm p-8 items-center justify-between gap-4 w-full">
      </div>
    </div>
	{:else}
		<p>Chargement des données utilisateur...</p>
	{/if}
</div>
