<script lang="ts">
	import { enhance } from '$app/forms';
	import { User } from '@lucide/svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let showEditUserModal = $state(false);
	let selectedUser: (typeof data.users)[0] | null = $state(null);
	let configError = $state<string | null>(null);
	let userError = $state<string | null>(null);

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

	const roles = [
		{ value: 'user', label: 'Utilisateur' },
		{ value: 'translator', label: 'Traducteur' },
		{ value: 'admin', label: 'Administrateur' },
		{ value: 'superadmin', label: 'Super Administrateur' }
	];
</script>

<section class="flex flex-col gap-8">
	<!-- Configuration de l'application -->
	<div class="flex flex-col gap-4">
		<h2 class="text-lg font-semibold text-base-content">Configuration de l'application</h2>

		<div class="card bg-base-100 shadow-sm p-8">
			{#if configError}
				<div class="alert alert-error mb-4">
					<span>{configError}</span>
				</div>
			{/if}

			<form method="POST" action="?/updateConfig" use:enhance={() => {
				configError = null;
				return async ({ result, update }) => {
					if (result.type === 'success') {
						await update();
						configError = null;
					} else if (result.type === 'failure' && result.data) {
						const message = typeof result.data === 'object' && 'message' in result.data 
							? String(result.data.message) 
							: 'Erreur lors de la mise à jour';
						configError = message;
					}
				};
			}}>
				<div class="flex flex-col gap-4">
					<div class="form-control w-full">
						<label for="appName" class="label">
							<span class="label-text">Nom de l'application</span>
						</label>
						<input
							id="appName"
							name="appName"
							type="text"
							class="input input-bordered w-full"
							class:input-error={configError}
							value={data.config?.appName || 'F95 France'}
							required
						/>
					</div>

					<div class="divider">Webhooks Discord</div>

					<div class="form-control w-full">
						<label for="discordWebhookUpdates" class="label">
							<span class="label-text">Webhook Discord - Updates</span>
						</label>
						<input
							id="discordWebhookUpdates"
							name="discordWebhookUpdates"
							type="url"
							class="input input-bordered w-full"
							value={data.config?.discordWebhookUpdates || ''}
							placeholder="https://discord.com/api/webhooks/..."
						/>
					</div>

					<div class="form-control w-full">
						<label for="discordWebhookLogs" class="label">
							<span class="label-text">Webhook Discord - Logs</span>
						</label>
						<input
							id="discordWebhookLogs"
							name="discordWebhookLogs"
							type="url"
							class="input input-bordered w-full"
							value={data.config?.discordWebhookLogs || ''}
							placeholder="https://discord.com/api/webhooks/..."
						/>
					</div>

					<div class="form-control w-full">
						<label for="discordWebhookTranslators" class="label">
							<span class="label-text">Webhook Discord - Translators</span>
						</label>
						<input
							id="discordWebhookTranslators"
							name="discordWebhookTranslators"
							type="url"
							class="input input-bordered w-full"
							value={data.config?.discordWebhookTranslators || ''}
							placeholder="https://discord.com/api/webhooks/..."
						/>
					</div>

					<div class="form-control w-full">
						<label for="discordWebhookProofreaders" class="label">
							<span class="label-text">Webhook Discord - Proofreaders</span>
						</label>
						<input
							id="discordWebhookProofreaders"
							name="discordWebhookProofreaders"
							type="url"
							class="input input-bordered w-full"
							value={data.config?.discordWebhookProofreaders || ''}
							placeholder="https://discord.com/api/webhooks/..."
						/>
					</div>

					<div class="divider">Google Sheets</div>

					<div class="form-control w-full">
						<label for="googleSpreadsheetId" class="label">
							<span class="label-text">ID du Spreadsheet Google</span>
						</label>
						<input
							id="googleSpreadsheetId"
							name="googleSpreadsheetId"
							type="text"
							class="input input-bordered w-full"
							value={data.config?.googleSpreadsheetId || ''}
							placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
						/>
					</div>

					<div class="form-control mt-4">
						<button type="submit" class="btn btn-primary">
							Enregistrer la configuration
						</button>
					</div>
				</div>
			</form>
		</div>
	</div>

	<!-- Gestion des utilisateurs -->
	<div class="flex flex-col gap-4">
		<h2 class="text-lg font-semibold text-base-content">
			Gestion des utilisateurs
			<span class="text-sm font-normal opacity-70">({data.totalUsers} utilisateur{data.totalUsers > 1 ? 's' : ''})</span>
		</h2>

		<div class="card bg-base-100 shadow-sm p-8">
			<div class="overflow-x-auto">
				<table class="table">
					<thead>
						<tr>
							<th></th>
							<th>Nom d'utilisateur</th>
							<th>Email</th>
							<th>Rôle</th>
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
											<div class="mask mask-squircle w-10 h-10 flex items-center justify-center">
												{#if user?.avatar && user.avatar !== ''}
                          {console.log(user.avatar)}
                          <img alt="avatar" src={user.avatar} />
                        {:else}
                          <User size={24} />
                        {/if}
											</div>
										</div>
										<span class="font-bold">{user.username}</span>
									</div>
								</td>
								<td>{user.email}</td>
								<td>
									<div class="badge badge-outline">
										{roles.find(r => r.value === user.role)?.label || user.role}
									</div>
								</td>
								<td>
									{new Date(user.createdAt).toLocaleDateString('fr-FR', {
										year: 'numeric',
										month: 'long',
										day: 'numeric'
									})}
								</td>
								<td>
									<button
										class="btn btn-primary btn-sm"
										onclick={() => openEditUserModal(user)}
									>
										Modifier
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Pagination (à implémenter si nécessaire) -->
			{#if data.totalUsers > data.pageSize}
				<div class="flex justify-center mt-4">
					<div class="join">
						<button class="join-item btn btn-sm" disabled>«</button>
						<button class="join-item btn btn-sm btn-active">1</button>
						<button class="join-item btn btn-sm">»</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
</section>

<!-- Modal d'édition d'utilisateur -->
{#if showEditUserModal && selectedUser}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="font-bold text-lg">Modifier l'utilisateur</h3>

			{#if userError}
				<div class="alert alert-error mt-4">
					<span>{userError}</span>
				</div>
			{/if}

			<form method="POST" action="?/updateUser" use:enhance={() => {
				userError = null;
				return async ({ result, update }) => {
					if (result.type === 'success') {
						await update();
						closeEditUserModal();
					} else if (result.type === 'failure' && result.data) {
						const message = typeof result.data === 'object' && 'message' in result.data 
							? String(result.data.message) 
							: 'Erreur lors de la mise à jour';
						userError = message;
					}
				};
			}}>
				<input type="hidden" name="userId" value={selectedUser.id} />

				<div class="form-control w-full mt-4">
					<label for="edit-username" class="label">
						<span class="label-text">Nom d'utilisateur</span>
					</label>
					<input
						id="edit-username"
						name="username"
						type="text"
						class="input input-bordered w-full"
						class:input-error={userError}
						value={selectedUser.username}
						required
					/>
				</div>

				<div class="form-control w-full mt-4">
					<label for="edit-email" class="label">
						<span class="label-text">Email</span>
					</label>
					<input
						id="edit-email"
						name="email"
						type="email"
						class="input input-bordered w-full"
						class:input-error={userError}
						value={selectedUser.email}
						required
					/>
				</div>

				<div class="form-control w-full mt-4">
					<label for="edit-avatar" class="label">
						<span class="label-text">Image de profil (URL)</span>
					</label>
					<input
						id="edit-avatar"
						name="avatar"
						type="url"
						class="input input-bordered w-full"
						class:input-error={userError}
						value={selectedUser.avatar}
						placeholder="https://example.com/avatar.jpg"
					/>
				</div>

				<div class="form-control w-full mt-4">
					<label for="edit-role" class="label">
						<span class="label-text">Rôle</span>
					</label>
					<select
						id="edit-role"
						name="role"
						class="select select-bordered w-full"
						class:select-error={userError}
						value={selectedUser.role}
						required
					>
						{#each roles as role}
							<option value={role.value}>{role.label}</option>
						{/each}
					</select>
				</div>

				<div class="modal-action">
					<button type="button" class="btn" onclick={closeEditUserModal}>
						Annuler
					</button>
					<button type="submit" class="btn btn-primary">
						Enregistrer
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
