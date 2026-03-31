<script lang="ts">
	import { enhance } from '$app/forms';
	import User from '@lucide/svelte/icons/user';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let showEditUserModal = $state(false);
	let selectedUser: (typeof data.users)[0] | null = $state(null);
	let userError = $state<string | null>(null);

	const roles = [
		{ value: 'user', label: 'Utilisateur' },
		{ value: 'translator', label: 'Traducteur' },
		{ value: 'admin', label: 'Administrateur' },
		{ value: 'superadmin', label: 'Super Administrateur' }
	];

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
</script>

<section class="flex flex-col gap-4">
	<h2 class="text-lg font-semibold text-base-content">
		Gestion des utilisateurs
		<span class="text-sm font-normal opacity-70"
			>({data.totalUsers} utilisateur{data.totalUsers > 1 ? 's' : ''})</span
		>
	</h2>

	<div class="card bg-base-100 p-8 shadow-sm">
		<div class="overflow-x-auto">
			<table class="table">
				<thead>
					<tr>
						<th></th>
						<th>Nom d'utilisateur</th>
						<th>Email</th>
						<th>Rôle</th>
						<th>Profil traducteur</th>
						<th>Date de création</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each data.users as user, index (user.id)}
						<tr>
							<td class="font-bold">{index + 1}</td>
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
									<a href={`/dashboard/profile/${user.id}`} class="link link-hover font-bold">
										{user.username}
									</a>
								</div>
							</td>
							<td>{user.email}</td>
							<td>
								<div class="badge badge-outline">
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
							<td>
								<button class="btn btn-sm btn-primary" onclick={() => openEditUserModal(user)}>
									Modifier
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if data.totalUsers > data.pageSize}
			<div class="mt-4 flex justify-center">
				<div class="join">
					<button class="btn join-item btn-sm" disabled>«</button>
					<button class="btn btn-active join-item btn-sm">1</button>
					<button class="btn join-item btn-sm">»</button>
				</div>
			</div>
		{/if}
	</div>
</section>

{#if showEditUserModal && selectedUser}
	<div class="modal-open modal">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Modifier l'utilisateur</h3>

			{#if userError}
				<div class="mt-4 alert alert-error">
					<span>{userError}</span>
				</div>
			{/if}

			<form
				method="POST"
				action="?/updateUser"
				use:enhance={() => {
					userError = null;
					return async function ({ result, update }) {
						if (result.type === 'success') {
							await update();
							closeEditUserModal();
						} else if (result.type === 'failure' && result.data) {
							const message =
								typeof result.data === 'object' && 'message' in result.data
									? String(result.data.message)
									: 'Erreur lors de la mise à jour';
							userError = message;
						}
					};
				}}
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
							<option value={role.value}>{role.label}</option>
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

				<div class="modal-action">
					<button type="button" class="btn" onclick={closeEditUserModal}> Annuler </button>
					<button type="submit" class="btn btn-primary"> Enregistrer </button>
				</div>
			</form>
		</div>
	</div>
{/if}
