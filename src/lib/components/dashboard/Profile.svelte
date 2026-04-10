<script lang="ts">
	import type { User as UserType } from '$lib/server/db/schema';
	import type { PublicUser } from '$lib/types';
	import CirclePlus from '@lucide/svelte/icons/circle-plus';
	import SquarePen from '@lucide/svelte/icons/square-pen';
	import User from '@lucide/svelte/icons/user';
	interface Props {
		user: PublicUser | UserType | null;
		email?: UserType['email'] | null;
		stats?: {
			gameAdd: number;
			gameEdit: number;
			submissionAdd: number;
			submissionEdit: number;
		} | null;
	}

	let { user, email, stats }: Props = $props();

	const roles: Record<PublicUser['role'], string> = {
		user: 'Utilisateur',
		admin: 'Administrateur',
		translator: 'Traducteur',
		superadmin: 'Super Admin'
	};
</script>

<div class="flex gap-8 flex-col md:flex-row">
	{#if user}
		<div class="flex flex-col gap-2">
			<div class="flex h-32 w-32 items-center justify-center rounded-full bg-base-300 p-4">
				{#if user.avatar && user.avatar !== ''}
					<img
						src={user.avatar}
						alt="Avatar de {user.username}"
						class="h-full w-full rounded-full object-cover"
					/>
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
				Membre depuis: {user?.createdAt
					? new Date(user.createdAt).toLocaleDateString('fr-FR')
					: '—'}
			</p>
		</div>

		<div class="flex w-full flex-col gap-4 mb-16">
			{#if stats}
				<div class="stats bg-base-100 shadow flex flex-col lg:flex-row gap-4">
					<div class="stat">
						<div class="stat-figure text-primary">
							<CirclePlus />
						</div>
						<div class="stat-title text-wrap">Jeu ajoutés (administrateur)</div>
						<div class="stat-value text-primary">{stats.gameAdd}</div>
					</div>

					<div class="stat">
						<div class="stat-figure text-secondary">
							<SquarePen />
						</div>
						<div class="stat-title text-wrap">Jeu modifiés (administrateur)</div>
						<div class="stat-value text-secondary">{stats.gameEdit}</div>
					</div>
				</div>
			{/if}
			{#if stats}
				<div class="stats bg-base-100 shadow flex flex-col lg:flex-row gap-4">
					<div class="stat">
						<div class="stat-figure text-primary">
							<CirclePlus />
						</div>
						<div class="stat-title text-wrap">Jeux/traductions ajoutés (soumissions)</div>
						<div class="stat-value text-primary">{stats.submissionAdd}</div>
					</div>

					<div class="stat">
						<div class="stat-figure text-secondary">
							<SquarePen />
						</div>
						<div class="stat-title text-wrap">Jeux/traductions modifiés (soumissions)</div>
						<div class="stat-value text-secondary">{stats.submissionEdit}</div>
					</div>
				</div>
			{/if}
		</div>
	{:else}
		<p>Chargement des données utilisateur...</p>
	{/if}
</div>
