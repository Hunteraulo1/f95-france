<script lang="ts">
	import { enhance } from '$app/forms';
	import { User } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let showEditUserModal = $state(false);
	let selectedUser: (typeof data.users)[0] | null = $state(null);
	let configError = $state<string | null>(null);
	let userError = $state<string | null>(null);
	let oauthMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);

	onMount(() => {
		// Vérifier les paramètres d'URL pour les messages OAuth2
		const urlParams = new URLSearchParams(window.location.search);
		if (urlParams.get('oauth_success') === 'true') {
			oauthMessage = { type: 'success', text: 'Autorisation OAuth2 réussie !' };
			// Nettoyer l'URL
			window.history.replaceState({}, '', '/dashboard/config');
		} else if (urlParams.get('oauth_error')) {
			oauthMessage = { type: 'error', text: `Erreur OAuth2: ${urlParams.get('oauth_error')}` };
			window.history.replaceState({}, '', '/dashboard/config');
		}
	});

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

		<div class="card bg-base-100 p-8 shadow-sm">
			{#if configError}
				<div class="mb-4 alert alert-error">
					<span>{configError}</span>
				</div>
			{/if}

			<form
				method="POST"
				action="?/updateConfig"
				use:enhance={() => {
					configError = null;
					return async ({ result, update }) => {
						if (result.type === 'success') {
							await update();
							configError = null;
						} else if (result.type === 'failure' && result.data) {
							const message =
								typeof result.data === 'object' && 'message' in result.data
									? String(result.data.message)
									: 'Erreur lors de la mise à jour';
							configError = message;
						}
					};
				}}
			>
				<div class="flex flex-col gap-4">
					<div class="form-control w-full">
						<label for="appName" class="label">
							<span class="label-text">Nom de l'application</span>
						</label>
						<input
							id="appName"
							name="appName"
							type="text"
							class="input-bordered input w-full"
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
							class="input-bordered input w-full"
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
							class="input-bordered input w-full"
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
							class="input-bordered input w-full"
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
							class="input-bordered input w-full"
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
							class="input-bordered input w-full"
							value={data.config?.googleSpreadsheetId || ''}
							placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
						/>
					</div>

					<div class="form-control w-full">
						<label for="googleApiKey" class="label">
							<span class="label-text">Clé API Google (optionnel si OAuth2 est configuré)</span>
						</label>
						<input
							id="googleApiKey"
							name="googleApiKey"
							type="password"
							class="input-bordered input w-full"
							value={data.config?.googleApiKey || ''}
							placeholder="AIzaSy..."
						/>
						<label class="label" for="googleApiKey">
							<span class="label-text-alt text-base-content/50">
								Requis pour accéder aux spreadsheets via l'API.
								<a
									href="https://console.cloud.google.com/apis/credentials"
									target="_blank"
									rel="noopener noreferrer"
									class="link link-primary"
								>
									Créer une clé API
								</a>
							</span>
						</label>
					</div>

					<div class="form-control w-full">
						<label for="googleOAuthClientId" class="label">
							<span class="label-text">Client ID OAuth2</span>
						</label>
						<input
							id="googleOAuthClientId"
							name="googleOAuthClientId"
							type="text"
							class="input-bordered input w-full"
							value={data.config?.googleOAuthClientId || ''}
							placeholder="xxxxx.apps.googleusercontent.com"
						/>
					</div>

					<div class="form-control w-full">
						<label for="googleOAuthClientSecret" class="label">
							<span class="label-text">Client Secret OAuth2</span>
						</label>
						<input
							id="googleOAuthClientSecret"
							name="googleOAuthClientSecret"
							type="password"
							class="input-bordered input w-full"
							value={data.config?.googleOAuthClientSecret || ''}
							placeholder="GOCSPX-..."
						/>
					</div>

					{#if data.config?.googleOAuthClientId && data.config?.googleOAuthClientSecret}
						<div class="mb-4 rounded-lg bg-base-200 p-4">
							<p class="mb-2 text-sm font-semibold">
								URI de redirection à configurer dans Google Cloud Console :
							</p>
							<code class="rounded bg-base-300 px-2 py-1 text-xs break-all">
								{typeof window !== 'undefined'
									? `${window.location.origin}/api/google-oauth/callback`
									: 'Chargement...'}
							</code>
							<p class="mt-2 text-xs text-base-content/70">
								⚠️ Cette URI doit être exactement la même dans Google Cloud Console → Identifiants
								OAuth 2.0 → URI de redirection autorisées
							</p>
						</div>

						<div class="form-control w-full">
							<a href="/api/google-oauth/authorize" class="btn btn-outline btn-primary">
								Autoriser avec Google
							</a>
							<div class="label">
								<span class="label-text-alt text-base-content/50">
									{#if data.config?.googleOAuthAccessToken}
										<span class="text-success">✓ Authentifié</span>
									{:else}
										Cliquez pour autoriser l'accès à Google Sheets
									{/if}
								</span>
							</div>
						</div>
					{/if}

					{#if oauthMessage}
						<div
							class={`alert ${oauthMessage.type === 'success' ? 'alert-success' : 'alert-error'}`}
						>
							<span>{oauthMessage.text}</span>
						</div>
					{/if}

					<div class="form-control mt-4">
						<button type="submit" class="btn btn-primary"> Enregistrer la configuration </button>
					</div>
				</div>
			</form>
		</div>
	</div>

	<!-- Gestion des utilisateurs -->
	<div class="flex flex-col gap-4">
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
										{roles.find((r) => r.value === user.role)?.label || user.role}
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
									<button class="btn btn-sm btn-primary" onclick={() => openEditUserModal(user)}>
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
				<div class="mt-4 flex justify-center">
					<div class="join">
						<button class="btn join-item btn-sm" disabled>«</button>
						<button class="btn btn-active join-item btn-sm">1</button>
						<button class="btn join-item btn-sm">»</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
</section>

<!-- Modal d'édition d'utilisateur -->
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
					return async ({ result, update }) => {
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

				<div class="modal-action">
					<button type="button" class="btn" onclick={closeEditUserModal}> Annuler </button>
					<button type="submit" class="btn btn-primary"> Enregistrer </button>
				</div>
			</form>
		</div>
	</div>
{/if}
