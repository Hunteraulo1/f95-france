<script lang="ts">
	import { user } from '$lib/stores';
	import { User } from '@lucide/svelte';
</script>

<div class="flex flex-col gap-4">
	<h2>Profil Utilisateur</h2>
	
	{#if $user}
		<div class="card bg-base-100 shadow-sm p-8 items-center justify-between gap-4 w-full">
			<div class="flex items-center justify-between gap-4 w-full">
        {#if $user.avatar && $user.avatar !== ''}
          <img src={$user.avatar} alt="Avatar de {$user.username}" class="w-16 h-16 rounded-full" />
        {:else}
          <User size={64} />
        {/if}
			</div>
			
			<div class="">
				<h3>{$user.username}</h3>
				<p>{$user.email}</p>
				<p>Rôle: {$user.role}</p>
				<p>
					Jeux ajoutés: {$user.gameAdd} | 
					Jeux modifiés: {$user.gameEdit}
				</p>
				<p>
					Membre depuis: {new Date($user.createdAt).toLocaleDateString('fr-FR')}
				</p>
			</div>
		</div>
	{:else}
		<p>Chargement des données utilisateur...</p>
	{/if}
</div>
