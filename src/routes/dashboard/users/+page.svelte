<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import DaisyDashboardModal from '$lib/components/dashboard/DaisyDashboardModal.svelte';
	import InfiniteScrollSentinel from '$lib/components/InfiniteScrollSentinel.svelte';
	import { createFormEnhance } from '$lib/forms/enhance';
	import { useInfiniteList } from '$lib/infinite-scroll/use-infinite-list.svelte';
	import { formatUserEmailForDisplay } from '$lib/permissions/user-email';
	import { newToast, roleBadgeStyles } from '$lib/stores';
	import { resolveDiscordAvatarDisplayUrl } from '$lib/utils/discord-avatar-url';
	import { roleBadgeClass, roleUsernameClass } from '$lib/utils/role-display';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import Mail from '@lucide/svelte/icons/mail';
	import User from '@lucide/svelte/icons/user';
	import { untrack } from 'svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let searchQuery = $state('');
	let searchTimer: ReturnType<typeof setTimeout> | null = null;

	let showEditUserModal = $state(false);
	let selectedUser: (typeof data.users)[0] | null = $state(null);
	let userError = $state<string | null>(null);

	let showPasswordResetModal = $state(false);
	let passwordResetUser: (typeof data.users)[0] | null = $state(null);
	let passwordResetSending = $state(false);
	let passwordResetError = $state<string | null>(null);

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

	const openPasswordResetModal = (user: (typeof data.users)[0]) => {
		passwordResetUser = user;
		passwordResetError = null;
		passwordResetSending = false;
		showPasswordResetModal = true;
	};

	const closePasswordResetModal = () => {
		if (passwordResetSending) return;
		showPasswordResetModal = false;
		passwordResetUser = null;
		passwordResetError = null;
	};

	const passwordResetEnhance = createFormEnhance({
		updateOnlyOnSuccess: true,
		onStart: () => {
			passwordResetError = null;
			passwordResetSending = true;
		},
		onFailure: (message) => {
			passwordResetSending = false;
			passwordResetError = message;
			newToast({ alertType: 'error', message });
		},
		onSuccess: (result) => {
			passwordResetSending = false;
			const message =
				(result.data as { message?: string } | undefined)?.message ??
				'Email de réinitialisation envoyé.';
			newToast({ alertType: 'success', message });
			closePasswordResetModal();
		}
	});

	const buildQuery = (overrides: { q?: string }) => {
		const qVal = overrides.q !== undefined ? overrides.q : (data.q ?? '');
		return qVal ? `?q=${encodeURIComponent(qVal)}` : '';
	};

	const navigateSearch = (value: string) => {
		goto(resolve(`/dashboard/users${buildQuery({ q: value })}` as '/dashboard/users'), {
			replaceState: true,
			keepFocus: true,
			noScroll: true,
			invalidateAll: true
		});
	};

	const onSearchInput = (value: string) => {
		searchQuery = value;
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => navigateSearch(value), 300);
	};

	const clearSearch = () => {
		if (searchTimer) clearTimeout(searchTimer);
		searchQuery = '';
		navigateSearch('');
	};

	$effect(() => {
		const incoming = data.q ?? '';
		untrack(() => {
			if (incoming !== searchQuery) {
				searchQuery = incoming;
			}
		});
	});

	type UserRow = (typeof data.users)[0];

	const list = useInfiniteList<UserRow>({
		getInitial: () => ({
			items: data.users ?? [],
			page: data.page ?? 1,
			totalPages: data.totalPages ?? 1
		}),
		getCacheKey: () => data.q ?? '',
		buildUrl: (nextPage) => {
			const parts = [`page=${nextPage}`];
			if (data.q) parts.unshift(`q=${encodeURIComponent(data.q)}`);
			return `${resolve('/dashboard/users')}?${parts.join('&')}`;
		},
		pickItems: (body) => (Array.isArray(body.users) ? (body.users as UserRow[]) : [])
	});

	const formatDateTime = (value: Date | string) =>
		new Intl.DateTimeFormat('fr-FR', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		}).format(value instanceof Date ? value : new Date(value));

	const formatRelativeTime = (value: Date | string) => {
		const date = value instanceof Date ? value : new Date(value);
		const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
		if (seconds < 10) return "à l'instant";
		if (seconds < 60) return `il y a ${seconds} s`;
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `il y a ${minutes} min`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `il y a ${hours} h`;
		const days = Math.floor(hours / 24);
		if (days < 30) return `il y a ${days} j`;
		const months = Math.floor(days / 30);
		if (months < 12) return `il y a ${months} mois`;
		const years = Math.floor(months / 12);
		return `il y a ${years} an${years > 1 ? 's' : ''}`;
	};
</script>

<section class="flex flex-col gap-4">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<h2 class="text-lg font-semibold text-base-content">
			Gestion des utilisateurs
			<span class="text-sm font-normal opacity-70"
				>({data.totalUsers} utilisateur{data.totalUsers > 1 ? 's' : ''}{data.q
					? ' trouvé' + (data.totalUsers > 1 ? 's' : '')
					: ''})</span
			>
		</h2>
		<label class="input flex max-w-md min-w-48 items-center gap-2">
			<span class="sr-only">Rechercher un utilisateur</span>
			<input
				type="search"
				class="grow"
				placeholder={data.canViewUserEmails
					? 'Rechercher (pseudo, email)…'
					: 'Rechercher (pseudo)…'}
				value={searchQuery}
				oninput={(e) => onSearchInput(e.currentTarget.value)}
			/>
			{#if searchQuery}
				<button
					type="button"
					class="btn btn-square btn-ghost btn-sm"
					onclick={clearSearch}
					aria-label="Effacer la recherche"
				>
					✕
				</button>
			{/if}
		</label>
	</div>

	<div class="card w-full border border-base-300 bg-base-100 shadow-xl">
		<div class="card-body gap-6 overflow-x-auto sm:p-8">
			<table class="table">
				<thead>
					<tr>
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
					{#each list.items as user (user.id)}
						<tr>
							<td>
								<div class="flex items-center gap-3">
									<div class="avatar">
										<div class="mask flex h-10 w-10 items-center justify-center mask-squircle">
											{#if user?.avatar && user.avatar !== ''}
												<img alt="avatar" src={resolveDiscordAvatarDisplayUrl(user.avatar)} />
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
							<td>{formatUserEmailForDisplay(user.email, data.canViewUserEmails)}</td>
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
									<span title={formatDateTime(user.lastConnectionAt)}>
										{formatRelativeTime(user.lastConnectionAt)}
									</span>
								{:else}
									<span class="text-base-content/60">Jamais</span>
								{/if}
							</td>
							<td>
								<div class="flex flex-wrap items-center gap-2">
									<button class="btn btn-primary btn-sm" onclick={() => openEditUserModal(user)}>
										Modifier
									</button>
									<button
										type="button"
										class="btn btn-outline btn-sm"
										onclick={() => openPasswordResetModal(user)}
									>
										Réinitialiser par email
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>

			<InfiniteScrollSentinel
				hasMore={list.hasMore}
				loading={list.loadingMore}
				error={list.loadMoreError}
				onLoadMore={list.loadMore}
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

				{#if data.canViewUserEmails}
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
				{/if}

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

{#if showPasswordResetModal && passwordResetUser}
	<DaisyDashboardModal
		open={showPasswordResetModal}
		title="Réinitialiser le mot de passe"
		description="Un email avec un lien sécurisé sera envoyé à l’adresse du compte."
		maxWidthClass="max-w-md"
		onClose={closePasswordResetModal}
	>
		{#if passwordResetError}
			<div role="alert" class="alert text-sm alert-error">
				<span>{passwordResetError}</span>
			</div>
		{/if}

		<div class="flex flex-col gap-4">
			<div class="flex justify-center">
				<div
					class="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"
				>
					<KeyRound size={28} strokeWidth={1.75} aria-hidden="true" />
				</div>
			</div>

			<div class="flex items-center gap-3 rounded-box border border-base-300 bg-base-200/50 p-4">
				<div class="avatar">
					<div class="mask flex h-12 w-12 items-center justify-center mask-squircle">
						{#if passwordResetUser.avatar}
							<img alt="" src={resolveDiscordAvatarDisplayUrl(passwordResetUser.avatar)} />
						{:else}
							<User size={24} />
						{/if}
					</div>
				</div>
				<div class="min-w-0 flex-1">
					<p
						class="truncate font-semibold {roleUsernameClass(
							passwordResetUser.role,
							$roleBadgeStyles[passwordResetUser.role]
						)}"
					>
						{passwordResetUser.username}
					</p>
					<p class="truncate text-sm text-base-content/70">
						{formatUserEmailForDisplay(passwordResetUser.email, data.canViewUserEmails)}
					</p>
					<div
						class="mt-1 badge badge-outline badge-sm {roleBadgeClass(
							passwordResetUser.role,
							$roleBadgeStyles[passwordResetUser.role]
						)}"
					>
						{roles.find((r) => r.value === passwordResetUser?.role)?.label ||
							passwordResetUser.role}
					</div>
				</div>
			</div>

			<div role="alert" class="alert text-sm alert-info">
				<span>
					L’utilisateur pourra choisir un nouveau mot de passe via le lien reçu par email. Son mot
					de passe actuel reste valide tant que le lien n’a pas été utilisé.
				</span>
			</div>

			<ul class="list-disc space-y-1.5 pl-5 text-sm text-base-content/70">
				<li>Le lien expire dans <strong>1 heure</strong>.</li>
				<li>Les sessions actives seront fermées après la réinitialisation.</li>
				<li>Un nouvel envoi est bloqué pendant <strong>2 minutes</strong>.</li>
			</ul>
		</div>

		<form
			id="password-reset-form"
			method="POST"
			action="?/sendPasswordReset"
			use:enhance={passwordResetEnhance}
		>
			<input type="hidden" name="userId" value={passwordResetUser.id} />
		</form>

		{#snippet footer()}
			<button
				type="button"
				class="btn"
				onclick={closePasswordResetModal}
				disabled={passwordResetSending}
			>
				Annuler
			</button>
			<button
				type="submit"
				form="password-reset-form"
				class="btn gap-2 btn-primary"
				disabled={passwordResetSending}
			>
				{#if passwordResetSending}
					<span class="loading loading-sm loading-spinner" aria-hidden="true"></span>
					Envoi en cours…
				{:else}
					<Mail size={16} aria-hidden="true" />
					Envoyer l’email
				{/if}
			</button>
		{/snippet}
	</DaisyDashboardModal>
{/if}
