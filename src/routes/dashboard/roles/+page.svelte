<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import DaisyDashboardModal from '$lib/components/dashboard/DaisyDashboardModal.svelte';
	import RoleOptionRadios from '$lib/components/dashboard/roles/RoleOptionRadios.svelte';
	import FlashAlert from '$lib/components/FlashAlert.svelte';
	import { createFormEnhance } from '$lib/forms/enhance';
	import type { PermissionKey } from '$lib/permissions/catalog';
	import {
		applyPermissionDependenciesToChecks,
		buildPermissionChecksFromRole,
		getDependentPermissions,
		getPermissionParent,
		permissionRequirementLabel
	} from '$lib/permissions/dependencies';
	import { profileDashboardHref } from '$lib/utils/profile-url';
	import { roleBadgeClass } from '$lib/utils/role-display';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let showCreateModal = $state(false);
	let flash = $state<{ type: 'success' | 'error'; text: string } | null>(null);
	let permissionChecks = $state<Record<string, boolean>>({});

	const selectedRole = $derived(
		data.roles.find((r) => r.slug === data.selectedSlug) ?? data.roles[0]
	);
	const canManageSelected = $derived(data.selectedCanManage);
	const isSelectedSuperadmin = $derived(data.isSelectedRoleSuperadmin);
	const roleFieldsLocked = $derived(!canManageSelected || isSelectedSuperadmin);
	const roleMetaLocked = $derived(selectedRole?.isSystem || isSelectedSuperadmin);
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
		void data.selectedSlug;
		permissionChecks = buildPermissionChecksFromRole({
			allPermissionKeys: data.allPermissionKeys,
			permissionGroups: data.permissionGroups,
			selectedKeys: data.selectedPermissions,
			allGranted: data.isSelectedRoleSuperadmin
		});
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

	const setFlashError = (text: string) => {
		flash = { type: 'error', text };
	};

	const formatDateTime = (value: Date | string) =>
		new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(
			value instanceof Date ? value : new Date(value)
		);

	const formEnhance = (options?: { locked?: boolean; onRedirect?: () => void }) =>
		createFormEnhance({
			locked: options?.locked,
			onFailure: setFlashError,
			onRedirect: options?.onRedirect
		});

	$effect(() => {
		if (data.noticeMessage) {
			flash = { type: 'success', text: data.noticeMessage };
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

	{#if flash}
		<FlashAlert type={flash.type} text={flash.text} />
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
	{#if data.canFixStaffRoles && data.staffRoleIssues.length > 0}
		<div role="alert" class="alert alert-warning">
			<div class="flex w-full flex-col gap-3">
				<p class="font-medium">Configuration des rôles staff incomplète</p>
				<ul class="flex flex-col gap-2 text-sm">
					{#each data.staffRoleIssues as issue (issue.slug)}
						<li
							class="flex flex-col gap-2 rounded-lg border border-warning/30 bg-base-100/80 p-3 sm:flex-row sm:items-center sm:justify-between"
						>
							<div>
								<span class="font-semibold">{issue.label}</span>
								<span class="font-mono text-xs opacity-60"> ({issue.slug})</span>
								<ul class="mt-1 list-inside list-disc text-base-content/80">
									{#if issue.missingStaff}
										<li>Flag « staff » non activé</li>
									{/if}
									{#if issue.missingColor}
										<li>Couleur de badge non définie (défaut)</li>
									{/if}
								</ul>
							</div>
							<form method="POST" action="?/fixStaffRole" use:enhance={formEnhance()}>
								<input type="hidden" name="slug" value={issue.slug} />
								<button type="submit" class="btn btn-sm btn-primary">Corriger</button>
							</form>
						</li>
					{/each}
				</ul>
			</div>
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
									<span class="text-xs opacity-60">
										{#if data.canEditRolePriority}
											Force {role.priority}
											<span class="opacity-50">·</span>
										{/if}
										{role.permissionCount} droit{role.permissionCount > 1 ? 's' : ''} effectif{role.permissionCount >
										1
											? 's'
											: ''}
									</span>
								</span>
								<span class="badge badge-ghost badge-xs">{role.userCount}</span>
							</a>
						</li>
					{/each}
				</ul>

				{#if data.staffUsers.length > 0}
					<div class="divider my-1"></div>
					<h4 class="px-1 text-sm font-semibold text-base-content/80">
						Équipe staff
						<span class="badge badge-accent badge-xs ml-1">{data.staffUsers.length}</span>
					</h4>
					<ul class="menu w-full menu-sm rounded-box bg-base-200 p-1 overflow-y-auto">
						{#each data.staffUsers as member (member.id)}
							<li class="w-full">
								<a href={resolve(profileDashboardHref(member.username))} class="gap-2">
									<div class="avatar">
										<div class="w-7 rounded-full">
											<img src={member.avatar} alt="" />
										</div>
									</div>
									<span class="flex min-w-0 flex-col">
										<span class={roleBadgeClass(member.role, member.badgeStyle)}
											>{member.username}</span
										>
										<span class="text-xs opacity-60">{member.roleLabel}</span>
										<span class="text-xs opacity-60">
											{#if member.lastConnectionAt}
												Dernière connexion le {formatDateTime(member.lastConnectionAt)}
											{:else}
												Dernière connexion inconnue
											{/if}
										</span>
									</span>
								</a>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="px-1 text-xs text-base-content/60">Aucun utilisateur avec un rôle staff.</p>
				{/if}
			</div>
		</div>

		{#if selectedRole}
			<div class="flex flex-col gap-6">
				{#if isSelectedSuperadmin}
					<div role="alert" class="alert alert-info">
						<span>
							Le rôle Super administrateur possède automatiquement tous les droits. Ces paramètres
							ne peuvent pas être modifiés.
						</span>
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
								<div class="mt-1 flex flex-wrap gap-1">
									{#if selectedRole.isSystem}
										<span class="badge badge-sm badge-info">Rôle système</span>
									{/if}
									{#if selectedRole.staff}
										<span class="badge badge-sm badge-accent">Staff</span>
									{/if}
								</div>
							</div>
							{#if !selectedRole.isSystem && canManageSelected}
								<form method="POST" action="?/deleteRole" use:enhance={formEnhance()}>
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
							use:enhance={formEnhance({ locked: roleFieldsLocked })}
						>
							<input type="hidden" name="slug" value={selectedRole.slug} />
							{#if selectedRole.isSystem}
								<input type="hidden" name="label" value={selectedRole.label} />
							{/if}
							<fieldset class="fieldset">
								<legend class="fieldset-legend">Libellé</legend>
								<input
									type="text"
									name={roleMetaLocked ? undefined : 'label'}
									class="input w-full"
									class:opacity-60={roleMetaLocked}
									value={selectedRole.label}
									readonly={roleMetaLocked}
									disabled={isSelectedSuperadmin}
									required={!roleMetaLocked}
								/>
							</fieldset>
							<fieldset class="fieldset">
								<legend class="fieldset-legend">Description</legend>
								<textarea
									name={roleMetaLocked ? undefined : 'description'}
									class="textarea w-full"
									class:opacity-60={roleMetaLocked}
									rows="2"
									readonly={roleMetaLocked}
									disabled={isSelectedSuperadmin}>{selectedRole.description ?? ''}</textarea
								>
							</fieldset>
							<RoleOptionRadios
								legend="Couleur du rôle"
								hint="Style du libellé et des badges (profils, liste utilisateurs, etc.)."
								name="badgeStyle"
								options={data.badgeStyleOptions}
								checkedValue={selectedRole.badgeStyle}
								disabled={isSelectedSuperadmin}
							>
								{#snippet label(option)}
									<span
										class="text-sm font-medium {roleBadgeClass(selectedRole.slug, option.value)}"
										>{option.label}</span
									>
								{/snippet}
							</RoleOptionRadios>
							<fieldset class="fieldset">
								<legend class="fieldset-legend">Équipe</legend>
								<label class="label cursor-pointer justify-start gap-3">
									<input
										type="checkbox"
										name="staff"
										value="on"
										class="checkbox checkbox-primary"
										checked={selectedRole.staff}
										disabled={roleFieldsLocked}
									/>
									<span class="label-text">
										Membre du staff (équipe du site, modération, outils internes)
									</span>
								</label>
							</fieldset>
							{#if data.canEditRolePriority}
								<fieldset class="fieldset">
									<legend class="fieldset-legend">Force du rôle</legend>
									<input
										type="number"
										name="priority"
										class="input w-full max-w-xs"
										min={data.rolePriorityMin}
										max={data.rolePriorityMax}
										step="1"
										value={selectedRole.priority}
										disabled={roleFieldsLocked}
									/>
									<p class="label text-xs">
										Plus la valeur est élevée, plus le rôle apparaît en premier (staff, liste des
										rôles). Réservé aux super administrateurs ({data.rolePriorityMin}–{data.rolePriorityMax}).
									</p>
								</fieldset>
							{/if}
							{#if selectedHasGamesManage}
								<RoleOptionRadios
									legend="Mode d'enregistrement"
									hint="Contrôle si les ajouts/modifications de jeux passent par une soumission ou sont appliqués directement en base."
									name="editMode"
									options={data.editModeOptions}
									checkedValue={selectedRole.storedEditMode}
									disabled={isSelectedSuperadmin}
									vertical
								/>
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
					use:enhance={formEnhance({ locked: roleFieldsLocked })}
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
											{@const permissionChoiceDisabled =
												isSelectedSuperadmin || isPermissionChoiceDisabled(perm.key)}
											{@const blockedByParent =
												permissionParent != null &&
												!isSelectedSuperadmin &&
												!(permissionChecks[permissionParent] ?? false)}
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
							<button type="submit" class="btn w-fit btn-primary">
								Enregistrer les permissions
							</button>
						{/if}
					</div>
				</form>
			</div>
		{/if}
	</div>
</section>

{#if showCreateModal}
	<DaisyDashboardModal
		open={showCreateModal}
		title="Créer un rôle"
		onClose={() => (showCreateModal = false)}
	>
		<form
			id="create-role-form"
			method="POST"
			action="?/createRole"
			class="flex flex-col gap-3"
			use:enhance={formEnhance({
				onRedirect: () => {
					showCreateModal = false;
				}
			})}
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
			<RoleOptionRadios
				legend="Couleur du rôle"
				name="badgeStyle"
				options={data.badgeStyleOptions}
				checkedValue="default"
				compact
			>
				{#snippet label(option)}
					<span class="text-sm {roleBadgeClass('preview', option.value)}">{option.label}</span>
				{/snippet}
			</RoleOptionRadios>
			<RoleOptionRadios
				legend="Mode d'enregistrement"
				name="editMode"
				options={data.editModeOptions}
				checkedValue="direct"
				vertical
			/>
			<fieldset class="fieldset">
				<legend class="fieldset-legend">Équipe</legend>
				<label class="label cursor-pointer justify-start gap-3">
					<input type="checkbox" name="staff" value="on" class="checkbox checkbox-primary" />
					<span class="label-text">Membre du staff</span>
				</label>
			</fieldset>
			{#if data.canEditRolePriority}
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Force du rôle</legend>
					<input
						type="number"
						name="priority"
						class="input w-full max-w-xs"
						min={data.rolePriorityMin}
						max={data.rolePriorityMax}
						step="1"
						value="0"
					/>
					<p class="label text-xs">
						Ordre d'affichage (staff, liste). {data.rolePriorityMin}–{data.rolePriorityMax}.
					</p>
				</fieldset>
			{/if}
		</form>
		{#snippet footer()}
			<button type="button" class="btn" onclick={() => (showCreateModal = false)}>Annuler</button>
			<button type="submit" form="create-role-form" class="btn btn-primary">Créer</button>
		{/snippet}
	</DaisyDashboardModal>
{/if}
