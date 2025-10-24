<script lang="ts">
	import { User } from '@lucide/svelte';
	import type { PageData } from './$types';
  interface Props {
    data: PageData
  }

  let { data }: Props = $props();
</script>

<div class="flex flex-col gap-4">
	<h2>Profil de { data.user?.username || '...' }</h2>
	
	{#if data.user}
		<div class="card bg-base-100 shadow-sm p-8 items-center justify-between gap-4 w-full">
			<div class="flex items-center justify-between gap-4 w-full">
        {#if data.user.avatar && data.user.avatar !== ''}
          <img src={data.user.avatar} alt="Avatar de {data.user.username}" class="w-16 h-16 rounded-full" />
        {:else}
          <User size={64} />
        {/if}
			</div>
			
			<div class="">
				<h3>{data.user.username}</h3>
				<p>{data.user.email}</p>
				<p>Rôle: {data.user.role}</p>
				<p>
					Jeux ajoutés: {data.user.gameAdd} | 
					Jeux modifiés: {data.user.gameEdit}
				</p>
				<p>
					Membre depuis: {new Date(data.user.createdAt).toLocaleDateString('fr-FR')}
				</p>
			</div>
		</div>
	{:else}
		<p>Chargement des données utilisateur...</p>
	{/if}
</div>
