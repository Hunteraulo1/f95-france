<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PermissionKey } from '$lib/permissions/catalog';
	import {
		applyPermissionDependenciesToChecks,
		getDependentPermissions,
		getPermissionParent,
		permissionRequirementLabel
	} from '$lib/permissions/dependencies';
	import { roleBadgeClass } from '$lib/utils/role-display';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let showCreateModal = $state(false);
	let message = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);
	let permissionChecks = $state<Record<string, boolean>>({});

	const selectedRole = $derived(
		data.roles.find((r) => r.slug === data.selectedSlug) ?? data.roles[0]
	);
	const canManageSelected = $derived(data.selectedCanManage);
	const isSelectedSuperadmin = $derived(data.isSelectedRoleSuperadmin);
	const roleFieldsLocked = $derived(!canManageSelected || isSelectedSuperadmin);
	const selectedHasGamesManage = $derived(
		isSelectedSuperadmin || (permissionChecks['games.manage'] ?? false)
	);
	const selectedEditModeMissing = $derived(
		selectedHasGamesManage && selectedRole != null && selectedRole.editMode == null
	);
	const rolesMissingEditModeCount = $derived(
		data.roles.filter((r) => r.hasGamesManage && r.editMode == null).length
	);

	$effect(() => {
		const slug = data.selectedSlug;
		const selected = data.selectedPermissions;
		const groups = data.permissionGroups;
		const next: Record<string, boolean> = {};
		if (data.isSelectedRoleSuperadmin) {
			for (const key of data.allPermissionKeys) {
				next[key] = true;
			}
		} else {
			for (const group of groups) {
				for (const item of group.items) {
					next[item.key] = selected.includes(item.key);
				}
			}
		}
		void slug;
		permissionChecks = applyPermissionDependenciesToChecks(next);
	});

	function isPermissionChoiceDisabled(key: string): boolean {
		if (roleFieldsLocked) return true;
		const parent = getPermissionParent(key as PermissionKey);
		if (!parent) return false;
		return !(permissionChecks[parent] ?? false);
	}

	function setPermissionChecked(key: string, checked: boolean) {
		const next: Record<string, boolean> = { ...permissionChecks, [key]: checked };
		if (!checked) {
			for (const dependent of getDependentPermissions(key as PermissionKey)) {
				next[dependent] = false;
			}
		}
		permissionChecks = applyPermissionDependenciesToChecks(next);
	}

	const roleHref = (slug: string) =>
		`${resolve('/dashboard/roles')}?role=${encodeURIComponent(slug)}`;

	$effect(() => {
		if (data.noticeMessage) {
			message = data.noticeMessage;
			errorMessage = null;
		}
	});
</script>

<section class="flex flex-col gap-6">
	<div class="flex flex-wrap items-center justify-between gap-4">
		<h2 class="text-lg font-semibold text-base-content">Rôles et permissions</h2>
		<button type="button" class="btn btn-sm btn-primary" onclick={() => (showCreateModal = true)}>
			Nouveau rôle
		</button>
	</div>

	{#if message}
		<div role="alert" class="alert alert-success">
			<span>{message}</span>
		</div>
	{/if}
	{#if errorMessage}
		<div role="alert" class="alert alert-error">
			<span>{errorMessage}</span>
		</div>
	{/if}
	{#if rolesMissingEditModeCount > 0}
		<div role="alert" class="alert alert-warning">
			<span>
				{rolesMissingEditModeCount === 1
					? 'Un rôle avec « Gestion des jeux » n’a pas de mode d’enregistrement valide'
					: `${rolesMissingEditModeCount} rôles avec « Gestion des jeux » n’ont pas de mode d’enregistrement valide`}
				— les utilisateurs concernés ne pourront pas enregistrer de jeux tant qu’un mode n’est pas configuré.
			</span>
		</div>
	{/if}

	<div class="grid gap-6 lg:grid-cols-[minmax(220px,280px)_1fr]">
		<div class="card border border-base-300 bg-base-100 shadow">
			<div class="card-body gap-2 p-4">
				<h3 class="card-title text-base">Rôles</h3>
				<ul class="menu w-full menu-sm rounded-box bg-base-200 p-1">
					{#each data.roles as role (role.slug)}
						<li>
							<a
								href={roleHref(role.slug)}
								class:menu-active={role.slug === data.selectedSlug}
								class="justify-between"
							>
								<span class="flex min-w-0 flex-col">
									<span class="flex flex-wrap items-center gap-1">
										<span class={roleBadgeClass(role.slug, role.badgeStyle)}>{role.label}</span>
										{#if role.hasGamesManage && role.editMode == null}
											<span class="badge badge-warning badge-xs">Mode manquant</span>
										{/if}
									</span>
									<span class="text-xs opacity-60"
										>{role.permissionCount} droit{role.permissionCount > 1 ? 's' : ''} effectif{role.permissionCount >
										1
											? 's'
											: ''}</span
									>
								</span>
								<span class="badge badge-ghost badge-xs">{role.userCount}</span>
							</a>
						</li>
					{/each}
				</ul>
			</div>
		</div>

		{#if selectedRole}
			<div class="flex flex-col gap-6">
				{#if isSelectedSuperadmin}
					<div role="alert" class="alert alert-info">
						<span
							>Le rôle Super administrateur possède automatiquement tous les droits. Ces paramètres
							ne peuvent pas être modifiés.</span
						>
					</div>
				{:else if !canManageSelected && data.selectedManageBlockedReason}
					<div role="alert" class="alert alert-warning">
						<span>{data.selectedManageBlockedReason}</span>
					</div>
				{/if}
				{#if selectedEditModeMissing}
					<div role="alert" class="alert alert-warning">
						<span>
							Mode d’enregistrement absent ou invalide en base pour ce rôle. Choisissez un mode
							ci-dessous et enregistrez — sans cela, les utilisateurs de ce rôle ne pourront pas
							ajouter ni modifier de jeux.
						</span>
					</div>
				{/if}
				<div class="card border border-base-300 bg-base-100 shadow">
					<div class="card-body gap-4">
						<div class="flex flex-wrap items-start justify-between gap-2">
							<div>
								<h3
									class="card-title text-base {roleBadgeClass(
										selectedRole.slug,
										selectedRole.badgeStyle
									)}"
								>
									{selectedRole.label}
								</h3>
								<p class="font-mono text-sm opacity-70">{selectedRole.slug}</p>
								{#if selectedRole.isSystem}
									<span class="mt-1 badge badge-sm badge-info">Rôle système</span>
								{/if}
							</div>
							{#if !selectedRole.isSystem && canManageSelected}
								<form
									method="POST"
									action="?/deleteRole"
									use:enhance={() => {
										return async ({ result, update }) => {
											if (result.type === 'failure') {
												errorMessage = (result.data as { message?: string })?.message ?? 'Erreur';
												message = null;
											}
											await update();
										};
									}}
								>
									<input type="hidden" name="slug" value={selectedRole.slug} />
									<button
										type="submit"
										class="btn btn-outline btn-sm btn-error"
										disabled={selectedRole.userCount > 0}
									>
										Supprimer
									</button>
								</form>
							{/if}
						</div>

						<form
							method="POST"
							action="?/updateRole"
							class="flex flex-col gap-3"
							use:enhance={() => {
								if (roleFieldsLocked) return () => {};
								return async ({ result, update }) => {
									if (result.type === 'failure') {
										errorMessage = (result.data as { message?: string })?.message ?? 'Erreur';
									}
									await update();
								};
							}}
						>
							<input type="hidden" name="slug" value={selectedRole.slug} />
							{#if selectedRole.isSystem}
								<input type="hidden" name="label" value={selectedRole.label} />
							{/if}
							<fieldset class="fieldset">
								<legend class="fieldset-legend">Libellé</legend>
								<input
									type="text"
									name={selectedRole.isSystem || isSelectedSuperadmin ? undefined : 'label'}
									class="input w-full"
									class:opacity-60={selectedRole.isSystem || isSelectedSuperadmin}
									value={selectedRole.label}
									readonly={selectedRole.isSystem || isSelectedSuperadmin}
									disabled={isSelectedSuperadmin}
									required={!selectedRole.isSystem && !isSelectedSuperadmin}
								/>
							</fieldset>
							<fieldset class="fieldset">
								<legend class="fieldset-legend">Description</legend>
								<textarea
									name={selectedRole.isSystem || isSelectedSuperadmin ? undefined : 'description'}
									class="textarea w-full"
									class:opacity-60={selectedRole.isSystem || isSelectedSuperadmin}
									rows="2"
									readonly={selectedRole.isSystem || isSelectedSuperadmin}
									disabled={isSelectedSuperadmin}>{selectedRole.description ?? ''}</textarea
								>
							</fieldset>
							<fieldset class="fieldset">
								<legend class="fieldset-legend">Couleur du rôle</legend>
								<p class="mb-2 text-xs text-base-content/70">
									Style du libellé et des badges (profils, liste utilisateurs, etc.).
								</p>
								<div class="grid gap-2 sm:grid-cols-2">
									{#each data.badgeStyleOptions as option (option.value)}
										<label
											class="flex items-start gap-3 rounded-lg border border-base-300 p-3 {isSelectedSuperadmin
												? 'opacity-60'
												: 'cursor-pointer hover:bg-base-200'}"
										>
											<input
												type="radio"
												name="badgeStyle"
												value={option.value}
												class="radio mt-0.5 radio-sm"
												checked={selectedRole.badgeStyle === option.value}
												disabled={isSelectedSuperadmin || option.disabled}
											/>
											<span class="flex min-w-0 flex-col gap-1">
												<span
													class="text-sm font-medium {roleBadgeClass(
														selectedRole.slug,
														option.value
													)}">{option.label}</span
												>
												<span class="text-xs opacity-70">{option.description}</span>
											</span>
										</label>
									{/each}
								</div>
							</fieldset>
							{#if selectedHasGamesManage}
								<fieldset class="fieldset">
									<legend class="fieldset-legend">Mode d'enregistrement</legend>
									<p class="mb-2 text-xs text-base-content/70">
										Contrôle si les ajouts/modifications de jeux passent par une soumission ou sont
										appliqués directement en base.
									</p>
									<div class="flex flex-col gap-2">
										{#each data.editModeOptions as option (option.value)}
											<label
												class="flex items-start gap-3 rounded-lg border border-base-300 p-3 {isSelectedSuperadmin
													? 'opacity-60'
													: 'cursor-pointer hover:bg-base-200'}"
											>
												<input
													type="radio"
													name="editMode"
													value={option.value}
													class="radio mt-0.5 radio-sm"
													checked={selectedRole.storedEditMode === option.value}
													disabled={isSelectedSuperadmin}
												/>
												<span class="flex flex-col gap-0.5">
													<span class="text-sm font-medium">{option.label}</span>
													<span class="text-xs opacity-70">{option.description}</span>
												</span>
											</label>
										{/each}
									</div>
								</fieldset>
							{:else}
								<p class="text-sm text-base-content/70">
									Le mode d’enregistrement ne s’applique qu’aux rôles disposant de la permission «
									Gestion des jeux ».
								</p>
							{/if}
							{#if canManageSelected && !isSelectedSuperadmin}
								<button type="submit" class="btn w-fit btn-sm btn-primary">
									{selectedRole.isSystem && selectedHasGamesManage
										? 'Enregistrer le mode'
										: 'Enregistrer'}
								</button>
							{/if}
						</form>
					</div>
				</div>

				<form
					method="POST"
					action="?/updatePermissions"
					class="card border border-base-300 bg-base-100 shadow"
					use:enhance={() => {
						if (roleFieldsLocked) return () => {};
						return async ({ result, update }) => {
							if (result.type === 'failure') {
								errorMessage = (result.data as { message?: string })?.message ?? 'Erreur';
							}
							await update();
						};
					}}
				>
					<input type="hidden" name="slug" value={selectedRole.slug} />
					<div class="card-body gap-4">
						<h3 class="card-title text-base">Permissions</h3>
						{#if !canManageSelected && !isSelectedSuperadmin}
							<ul class="flex flex-wrap gap-2">
								{#each data.selectedPermissionDetails as perm (perm.key)}
									<li class="badge badge-outline">{perm.label}</li>
								{/each}
							</ul>
						{/if}
						{#if canManageSelected || isSelectedSuperadmin}
							{#each data.permissionGroups as group (group.group)}
								<div class="flex flex-col gap-2">
									<p class="text-sm font-semibold text-base-content/80">{group.group}</p>
									<div class="grid gap-2 sm:grid-cols-2">
										{#each group.items as perm (perm.key)}
											{@const permissionParent = getPermissionParent(perm.key)}
											{@const blockedByParent =
												!isSelectedSuperadmin &&
												permissionParent != null &&
												!(permissionChecks[permissionParent] ?? false)}
											{@const permissionChoiceDisabled =
												isSelectedSuperadmin || isPermissionChoiceDisabled(perm.key)}
											<label
												class="flex items-start gap-2 rounded-lg border border-base-300 p-3 {canManageSelected &&
												!isSelectedSuperadmin &&
												!permissionChoiceDisabled
													? 'cursor-pointer hover:bg-base-200'
													: 'opacity-80'} {permissionChoiceDisabled && !isSelectedSuperadmin
													? 'cursor-not-allowed'
													: ''}"
											>
												<input
													type="checkbox"
													name="permissions"
													value={perm.key}
													class="checkbox mt-0.5 checkbox-sm"
													checked={isSelectedSuperadmin || (permissionChecks[perm.key] ?? false)}
													onchange={(event) =>
														setPermissionChecked(perm.key, event.currentTarget.checked)}
													disabled={permissionChoiceDisabled}
												/>
												<span class="flex flex-col gap-0.5">
													<span class="text-sm font-medium">{perm.label}</span>
													<span class="text-xs opacity-70">{perm.description}</span>
													{#if blockedByParent && permissionParent}
														<span class="text-xs text-warning">
															Nécessite « {permissionRequirementLabel(permissionParent)} »
														</span>
													{/if}
												</span>
											</label>
										{/each}
									</div>
								</div>
							{/each}
						{/if}
						{#if canManageSelected && !isSelectedSuperadmin}
							<button type="submit" class="btn w-fit btn-primary"
								>Enregistrer les permissions</button
							>
						{/if}
					</div>
				</form>
			</div>
		{/if}
	</div>
</section>

{#if showCreateModal}
	<dialog class="modal-open modal">
		<div class="modal-box max-w-lg">
			<h3 class="text-lg font-bold">Créer un rôle</h3>
			<form
				method="POST"
				action="?/createRole"
				class="mt-4 flex flex-col gap-3"
				use:enhance={() => {
					return async ({ result, update }) => {
						if (result.type === 'failure') {
							errorMessage = (result.data as { message?: string })?.message ?? 'Erreur';
							message = null;
						} else if (result.type === 'redirect') {
							showCreateModal = false;
						}
						await update();
					};
				}}
			>
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Libellé</legend>
					<input type="text" name="label" class="input w-full" required placeholder="Modérateur" />
				</fieldset>
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Identifiant (slug)</legend>
					<input
						type="text"
						name="slug"
						class="input w-full font-mono"
						placeholder="moderateur (optionnel, généré depuis le libellé)"
					/>
					<p class="label text-xs">Lettres minuscules, chiffres et tirets uniquement</p>
				</fieldset>
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Description</legend>
					<textarea name="description" class="textarea w-full" rows="2"></textarea>
				</fieldset>
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Couleur du rôle</legend>
					<div class="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
						{#each data.badgeStyleOptions as option (option.value)}
							<label
								class="flex cursor-pointer items-start gap-2 rounded-lg border border-base-300 p-2"
							>
								<input
									type="radio"
									name="badgeStyle"
									value={option.value}
									class="radio mt-0.5 radio-sm"
									checked={option.value === 'default'}
								/>
								<span class="text-sm {roleBadgeClass('preview', option.value)}">{option.label}</span
								>
							</label>
						{/each}
					</div>
				</fieldset>
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Mode d'enregistrement</legend>
					<div class="flex flex-col gap-2">
						{#each data.editModeOptions as option (option.value)}
							<label
								class="flex cursor-pointer items-start gap-3 rounded-lg border border-base-300 p-3"
							>
								<input
									type="radio"
									name="editMode"
									value={option.value}
									class="radio mt-0.5 radio-sm"
									checked={option.value === 'direct'}
								/>
								<span class="flex flex-col gap-0.5">
									<span class="text-sm font-medium">{option.label}</span>
									<span class="text-xs opacity-70">{option.description}</span>
								</span>
							</label>
						{/each}
					</div>
				</fieldset>
				<div class="modal-action">
					<button type="button" class="btn" onclick={() => (showCreateModal = false)}>
						Annuler
					</button>
					<button type="submit" class="btn btn-primary">Créer</button>
				</div>
			</form>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button type="button" onclick={() => (showCreateModal = false)}>Fermer</button>
		</form>
	</dialog>
{/if}
