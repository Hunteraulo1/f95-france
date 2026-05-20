<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let showCreateModal = $state(false);
	let message = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);

	const selectedRole = $derived(
		data.roles.find((r) => r.slug === data.selectedSlug) ?? data.roles[0]
	);

	const roleHref = (slug: string) =>
		resolve(
			`/dashboard/roles${slug === data.roles[0]?.slug ? '' : `?role=${slug}`}` as '/dashboard/roles'
		);
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
									<span>{role.label}</span>
									<span class="text-xs opacity-60"
										>{role.permissionCount} droit{role.permissionCount > 1 ? 's' : ''}</span
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
				<div class="card border border-base-300 bg-base-100 shadow">
					<div class="card-body gap-4">
						<div class="flex flex-wrap items-start justify-between gap-2">
							<div>
								<h3 class="card-title text-base">{selectedRole.label}</h3>
								<p class="font-mono text-sm opacity-70">{selectedRole.slug}</p>
								{#if selectedRole.isSystem}
									<span class="mt-1 badge badge-sm badge-info">Rôle système</span>
								{/if}
							</div>
							{#if !selectedRole.isSystem}
								<form
									method="POST"
									action="?/deleteRole"
									use:enhance={() => {
										return async ({ result, update }) => {
											if (result.type === 'failure') {
												errorMessage = (result.data as { message?: string })?.message ?? 'Erreur';
												message = null;
											} else if (result.type === 'success') {
												message = (result.data as { message?: string })?.message ?? 'Rôle supprimé';
												errorMessage = null;
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
								return async ({ result, update }) => {
									if (result.type === 'failure') {
										errorMessage = (result.data as { message?: string })?.message ?? 'Erreur';
									} else if (result.type === 'success') {
										message = (result.data as { message?: string })?.message ?? 'Enregistré';
										errorMessage = null;
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
									name={selectedRole.isSystem ? undefined : 'label'}
									class="input w-full"
									class:opacity-60={selectedRole.isSystem}
									value={selectedRole.label}
									readonly={selectedRole.isSystem}
									required={!selectedRole.isSystem}
								/>
							</fieldset>
							<fieldset class="fieldset">
								<legend class="fieldset-legend">Description</legend>
								<textarea
									name={selectedRole.isSystem ? undefined : 'description'}
									class="textarea w-full"
									class:opacity-60={selectedRole.isSystem}
									rows="2"
									readonly={selectedRole.isSystem}>{selectedRole.description ?? ''}</textarea
								>
							</fieldset>
							<fieldset class="fieldset">
								<legend class="fieldset-legend">Mode d'enregistrement</legend>
								<p class="mb-2 text-xs text-base-content/70">
									Contrôle si les ajouts/modifications de jeux passent par une soumission ou sont
									appliqués directement en base.
								</p>
								<div class="flex flex-col gap-2">
									{#each data.editModeOptions as option (option.value)}
										<label
											class="flex cursor-pointer items-start gap-3 rounded-lg border border-base-300 p-3 hover:bg-base-200"
										>
											<input
												type="radio"
												name="editMode"
												value={option.value}
												class="radio mt-0.5 radio-sm"
												checked={selectedRole.editMode === option.value}
											/>
											<span class="flex flex-col gap-0.5">
												<span class="text-sm font-medium">{option.label}</span>
												<span class="text-xs opacity-70">{option.description}</span>
											</span>
										</label>
									{/each}
								</div>
							</fieldset>
							<button type="submit" class="btn w-fit btn-sm btn-primary">
								{selectedRole.isSystem ? 'Enregistrer le mode' : 'Enregistrer'}
							</button>
						</form>
					</div>
				</div>

				<form
					method="POST"
					action="?/updatePermissions"
					class="card border border-base-300 bg-base-100 shadow"
					use:enhance={() => {
						return async ({ result, update }) => {
							if (result.type === 'failure') {
								errorMessage = (result.data as { message?: string })?.message ?? 'Erreur';
							} else if (result.type === 'success') {
								message =
									(result.data as { message?: string })?.message ?? 'Permissions enregistrées';
								errorMessage = null;
							}
							await update();
						};
					}}
				>
					<input type="hidden" name="slug" value={selectedRole.slug} />
					<div class="card-body gap-4">
						<h3 class="card-title text-base">Permissions</h3>
						{#each data.permissionGroups as group (group.group)}
							<div class="flex flex-col gap-2">
								<p class="text-sm font-semibold text-base-content/80">{group.group}</p>
								<div class="grid gap-2 sm:grid-cols-2">
									{#each group.items as perm (perm.key)}
										<label
											class="flex cursor-pointer items-start gap-2 rounded-lg border border-base-300 p-3 hover:bg-base-200"
										>
											<input
												type="checkbox"
												name="permissions"
												value={perm.key}
												class="checkbox mt-0.5 checkbox-sm"
												checked={data.selectedPermissions.includes(perm.key)}
											/>
											<span class="flex flex-col gap-0.5">
												<span class="text-sm font-medium">{perm.label}</span>
												<span class="text-xs opacity-70">{perm.description}</span>
											</span>
										</label>
									{/each}
								</div>
							</div>
						{/each}
						<button type="submit" class="btn w-fit btn-primary">Enregistrer les permissions</button>
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
						} else if (result.type === 'success') {
							const slug = (result.data as { selectedSlug?: string })?.selectedSlug;
							message = (result.data as { message?: string })?.message ?? 'Rôle créé';
							errorMessage = null;
							showCreateModal = false;
							if (slug) {
								window.location.href = roleHref(slug);
							}
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
