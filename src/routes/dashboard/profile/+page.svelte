<script lang="ts">
	import { user } from '$lib/stores';
</script>

<div class="user-profile">
	<h2>Profil Utilisateur</h2>
	
	{#if $user}
		<div class="user-info">
			<div class="avatar">
				<img src={$user.avatar} alt="Avatar de {$user.username}" class="w-16 h-16 rounded-full" />
			</div>
			
			<div class="user-details">
				<h3>{$user.username}</h3>
				<p class="email">{$user.email}</p>
				<p class="role">Rôle: {$user.role}</p>
				<p class="theme">Thème: {$user.theme}</p>
				<p class="stats">
					Jeux ajoutés: {$user.gameAdd} | 
					Jeux modifiés: {$user.gameEdit}
				</p>
				<p class="dates">
					Membre depuis: {new Date($user.createdAt).toLocaleDateString('fr-FR')}
				</p>
			</div>
		</div>
	{:else}
		<p>Chargement des données utilisateur...</p>
	{/if}
</div>

<style>
	.user-profile {
		padding: 1rem;
		background: white;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0,0,0,0.1);
	}
	
	.user-info {
		display: flex;
		gap: 1rem;
		align-items: center;
	}
	
	.user-details h3 {
		margin: 0 0 0.5rem 0;
		color: #333;
	}
	
	.user-details p {
		margin: 0.25rem 0;
		color: #666;
	}
	
	.email {
		font-weight: 500;
	}
	
	.stats {
		font-size: 0.9rem;
		color: #888;
	}
	
	.dates {
		font-size: 0.8rem;
		color: #aaa;
	}
</style>
