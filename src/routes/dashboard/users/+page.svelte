<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import DaisyDashboardModal from '$lib/components/dashboard/DaisyDashboardModal.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import { createFormEnhance } from '$lib/forms/enhance';
	import { roleBadgeStyles } from '$lib/stores';
	import { roleBadgeClass, roleUsernameClass } from '$lib/utils/role-display';
	import User from '@lucide/svelte/icons/user';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let showEditUserModal = $state(false);
	let selectedUser: (typeof data.users)[0] | null = $state(null);
	let userError = $state<string | null>(null);

	const roles = $derived(data.roles);

	const openEditUserModal = (user: (typeof data.users)[0]) => {
		selectedUser = user;
		showEditUserModal = true;
		userError = null;
	};

	const closeEditUserModal = () => {
		showEditUserModal = false;
		selectedUser = null;
		userError = null;
	};

	const buildQuery = (overrides: { page?: number }) => {
		const page = overrides.page ?? data.page;
		return page > 1 ? `?page=${page}` : '';
	};

	const buildHref = (overrides: { page?: number }) =>
		resolve(`/dashboard/users${buildQuery(overrides)}` as '/dashboard/users');

	const hrefForPage = (p: number) => buildHref({ page: p });

	const formatDateTime = (value: Date | string) =>
		new Intl.DateTimeFormat('fr-FR', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		}).format(value instanceof Date ? value : new Date(value));
</script>

<section class="flex flex-col gap-4">
	<h2 class="text-lg font-semibold text-base-content">
		Gestion des utilisateurs
		<span class="text-sm font-normal opacity-70"
			>({data.totalUsers} utilisateur{data.totalUsers > 1 ? 's' : ''})</span
		>
	</h2>

	<div class="card w-full border border-base-300 bg-base-100 shadow-xl">
		<div class="card-body gap-6 overflow-x-auto sm:p-8">
			<table class="table">
				<thead>
					<tr>
						<th></th>
						<th>Nom d'utilisateur</th>
						<th>Email</th>
						<th>Rôle</th>
						<th>Profil traducteur</th>
						<th>Date de création</th>
						<th>Dernière connexion</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each data.users as user, index (user.id)}
						<tr>
							<td class="font-bold">{(data.page - 1) * data.pageSize + index + 1}</td>
							<td>
								<div class="flex items-center gap-3">
									<div class="avatar">
										<div class="mask flex h-10 w-10 items-center justify-center mask-squircle">
											{#if user?.avatar && user.avatar !== ''}
												<img alt="avatar" src={user.avatar} />
											{:else}
												<User size={24} />
											{/if}
										</div>
									</div>
									<a
										href={resolve(`/dashboard/profile/${user.username}`)}
										class="link font-bold text-nowrap link-hover {roleUsernameClass(
											user.role,
											$roleBadgeStyles[user.role]
										)}"
									>
										{user.username}
									</a>
								</div>
							</td>
							<td>{user.email}</td>
							<td>
								<div
									class="badge badge-outline text-nowrap {roleBadgeClass(
										user.role,
										$roleBadgeStyles[user.role]
									)}"
								>
									{roles.find((r) => r.value === user.role)?.label || user.role}
								</div>
							</td>
							<td>
								<span class="text-sm">
									{data.translators.find((t) => t.userId === user.id)?.name ?? '—'}
								</span>
							</td>
							<td>
								{new Date(user.createdAt).toLocaleDateString('fr-FR', {
									year: 'numeric',
									month: 'long',
									day: 'numeric'
								})}
							</td>
							<td class="text-sm">
								{#if user.lastConnectionAt}
									{formatDateTime(user.lastConnectionAt)}
								{:else}
									<span class="text-base-content/60">Jamais</span>
								{/if}
							</td>
							<td>
								<button class="btn btn-sm btn-primary" onclick={() => openEditUserModal(user)}>
									Modifier
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>

			<Pagination
				currentPage={data.page}
				totalPages={data.totalPages}
				totalCount={data.totalUsers}
				{hrefForPage}
				countLabel="utilisateur"
			/>
		</div>
	</div>
</section>

{#if showEditUserModal && selectedUser}
	<DaisyDashboardModal
		open={showEditUserModal}
		title="Modifier l'utilisateur"
		onClose={closeEditUserModal}
	>
		{#if selectedUser}
			{#if userError}
				<div class="alert alert-error">
					<span>{userError}</span>
				</div>
			{/if}

			<form
				id="edit-user-form"
				method="POST"
				action="?/updateUser"
				use:enhance={createFormEnhance({
					updateOnlyOnSuccess: true,
					onStart: () => {
						userError = null;
					},
					onFailure: (message) => {
						userError = message;
					},
					onSuccess: () => {
						closeEditUserModal();
					}
				})}
			>
				<input type="hidden" name="userId" value={selectedUser.id} />

				<div class="form-control mt-4 w-full">
					<label for="edit-username" class="label">
						<span class="label-text">Nom d'utilisateur</span>
					</label>
					<input
						id="edit-username"
						name="username"
						type="text"
						class="input-bordered input w-full"
						class:input-error={userError}
						value={selectedUser.username}
						required
					/>
				</div>

				<div class="form-control mt-4 w-full">
					<label for="edit-email" class="label">
						<span class="label-text">Email</span>
					</label>
					<input
						id="edit-email"
						name="email"
						type="email"
						class="input-bordered input w-full"
						class:input-error={userError}
						value={selectedUser.email}
						required
					/>
				</div>

				<div class="form-control mt-4 w-full">
					<label for="edit-avatar" class="label">
						<span class="label-text">Image de profil (URL)</span>
					</label>
					<input
						id="edit-avatar"
						name="avatar"
						type="url"
						class="input-bordered input w-full"
						class:input-error={userError}
						value={selectedUser.avatar}
						placeholder="https://example.com/avatar.jpg"
					/>
				</div>

				<div class="form-control mt-4 w-full">
					<label for="edit-role" class="label">
						<span class="label-text">Rôle</span>
					</label>
					<select
						id="edit-role"
						name="role"
						class="select-bordered select w-full"
						class:select-error={userError}
						value={selectedUser.role}
						required
					>
						{#each roles as role (role.value)}
							{#if role.assignable || role.value === selectedUser.role}
								<option value={role.value} disabled={!role.assignable}>
									{role.label}{role.assignable ? '' : ' (non attribuable)'}
								</option>
							{/if}
						{/each}
					</select>
				</div>

				<div class="form-control mt-4 w-full">
					<label for="edit-translator" class="label">
						<span class="label-text">Profil traducteur lié</span>
					</label>
					<select
						id="edit-translator"
						name="linkedTranslatorId"
						class="select-bordered select w-full"
						class:select-error={userError}
					>
						<option
							value=""
							selected={!data.translators.some((t) => t.userId === selectedUser?.id)}
						>
							Aucun
						</option>
						{#each data.translators as tr (tr.id)}
							<option value={tr.id} selected={tr.userId === selectedUser?.id}>
								{tr.name}
							</option>
						{/each}
					</select>
					<p class="label text-xs text-base-content/60">
						Lie ce compte à une fiche traducteur/relecteur (même choix que sur la page Traducteurs).
					</p>
				</div>
			</form>
		{/if}
		{#snippet footer()}
			<button type="button" class="btn" onclick={closeEditUserModal}>Annuler</button>
			<button type="submit" form="edit-user-form" class="btn btn-primary">Enregistrer</button>
		{/snippet}
	</DaisyDashboardModal>
{/if}
