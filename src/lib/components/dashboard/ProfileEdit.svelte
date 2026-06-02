<script lang="ts">
	import { enhance } from '$app/forms';
	import { createFormEnhance } from '$lib/forms/enhance';
	import type { RoleEditMode } from '$lib/permissions/edit-mode';
	import type { ProfileCustomizeFlags } from '$lib/permissions/profile-customize';
	import type { CustomProfileTheme } from '$lib/profile/custom-profile';
	import {
		PROFILE_BACKGROUND_SIZE_LABEL,
		PROFILE_BIO_MAX_LENGTH,
		PROFILE_CURSOR_DISPLAY_PX
	} from '$lib/profile/custom-profile';
	import { loadUserData } from '$lib/stores';

	type LinkedTranslator = {
		id: string;
		name: string;
		pages: Array<{ name: string; link: string }>;
	};

	interface Props {
		username: string;
		avatar: string;
		publicProfileHref: string;
		profileCustomize: ProfileCustomizeFlags;
		customProfile?: CustomProfileTheme | null;
		linkedTranslator?: LinkedTranslator | null;
		translatorPagesWriteMode?: 'direct' | 'submission' | null;
		roleEditMode?: RoleEditMode | null;
		directMode?: boolean;
	}

	let {
		username,
		avatar,
		publicProfileHref,
		profileCustomize,
		customProfile = null,
		linkedTranslator = null,
		translatorPagesWriteMode = null,
		roleEditMode = null,
		directMode = true
	}: Props = $props();

	let profileUsername = $state('');
	let profileAvatar = $state('');
	let profileInfoError = $state<string | null>(null);
	let profileInfoSuccess = $state<string | null>(null);

	let profileBio = $state('');
	let profileBackgroundUrl = $state('');
	let profileMusicUrl = $state('');
	let profileCursorUrl = $state('');
	let customProfileError = $state<string | null>(null);
	let customProfileInfo = $state<string | null>(null);

	let translatorPages = $state<Array<{ name: string; link: string }>>([{ name: '', link: '' }]);
	let translatorPagesError = $state<string | null>(null);
	let translatorPagesInfo = $state<string | null>(null);
	let initialTranslatorPagesSignature = $state('[]');

	const normalizeTranslatorPages = (pages: Array<{ name: string; link: string }>) =>
		pages
			.map((page) => ({ name: page.name.trim(), link: page.link.trim() }))
			.filter((page) => page.name !== '' || page.link !== '');

	$effect(() => {
		profileUsername = username;
		profileAvatar = avatar;
	});

	$effect(() => {
		if (profileCustomize.any && customProfile) {
			profileBio = customProfile.bio;
			profileBackgroundUrl = customProfile.backgroundUrl ?? '';
			profileMusicUrl = customProfile.musicUrl ?? '';
			profileCursorUrl = customProfile.cursorUrl ?? '';
		}
	});

	$effect(() => {
		if (linkedTranslator?.pages?.length) {
			translatorPages = linkedTranslator.pages.map((p) => ({ ...p }));
		} else if (linkedTranslator) {
			translatorPages = [{ name: '', link: '' }];
		}

		if (linkedTranslator) {
			initialTranslatorPagesSignature = JSON.stringify(
				normalizeTranslatorPages(linkedTranslator.pages ?? [])
			);
		}
	});

	const currentTranslatorPagesSignature = $derived(
		JSON.stringify(normalizeTranslatorPages(translatorPages))
	);
	const hasTranslatorPagesChanges = $derived(
		currentTranslatorPagesSignature !== initialTranslatorPagesSignature
	);

	const addTranslatorPage = () => {
		translatorPages = [...translatorPages, { name: '', link: '' }];
	};

	const removeTranslatorPage = (index: number) => {
		translatorPages = translatorPages.filter((_, i) => i !== index);
	};
</script>

<section class="mx-auto flex w-full max-w-3xl flex-col gap-6">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Modifier mon profil</h1>
			<p class="mt-1 text-sm text-base-content/70">
				Personnalisation pour <span class="font-medium">{username}</span>
			</p>
		</div>
		<a href={publicProfileHref} class="btn btn-outline btn-sm">Voir mon profil</a>
	</div>

	<div class="card border border-base-300 bg-base-100 shadow-sm">
		<div class="card-body gap-4">
			<h2 class="text-lg font-semibold text-base-content">Informations du profil</h2>
			<p class="text-sm text-base-content/70">
				Ces champs sont affichés sur votre
				<a href={publicProfileHref} class="link link-hover">profil public</a>.
			</p>

			{#if profileInfoError}
				<div class="alert alert-error">
					<span>{profileInfoError}</span>
				</div>
			{/if}
			{#if profileInfoSuccess}
				<div class="alert alert-success">
					<span>{profileInfoSuccess}</span>
				</div>
			{/if}

			<form
				method="POST"
				action="?/updateProfile"
				use:enhance={createFormEnhance({
					onStart: () => {
						profileInfoError = null;
						profileInfoSuccess = null;
					},
					onFailure: (message) => {
						profileInfoError = message;
					},
					onSuccess: async (result) => {
						await loadUserData();
						profileInfoSuccess =
							typeof result.data === 'object' && result.data && 'message' in result.data
								? String(result.data.message)
								: 'Profil mis à jour avec succès';
					}
				})}
			>
				<div class="flex w-full flex-col gap-4 md:flex-row">
					<label class="input flex w-full items-start">
						<span class="label h-full">Pseudo</span>
						<input
							type="text"
							name="username"
							class="grow w-full"
							placeholder="Pseudo"
							bind:value={profileUsername}
							required
						/>
					</label>
					<label class="input flex w-full items-start">
						<span class="label h-full">Photo de profil</span>
						<input
							type="url"
							name="avatar"
							class="grow w-full"
							placeholder="https://exemple.com/photo.jpg"
							bind:value={profileAvatar}
						/>
					</label>
				</div>
				<div class="mt-4 flex justify-end">
					<button type="submit" class="btn btn-primary">Enregistrer</button>
				</div>
			</form>
		</div>
	</div>

	{#if linkedTranslator}
		<div class="card border border-base-300 bg-base-100 shadow-sm">
			<div class="card-body gap-4">
				<h2 class="text-lg font-semibold text-base-content">Pages traducteur</h2>
				<p class="text-sm text-base-content/70">
					Liens affichés sur votre
					<a href={publicProfileHref} class="link link-hover">profil public</a>. Fiche liée :
					<span class="font-medium">{linkedTranslator.name}</span>.
					{#if translatorPagesWriteMode === 'direct'}
						Les modifications sont appliquées immédiatement.
					{:else}
						Les modifications sont soumises à validation admin.
					{/if}
				</p>

				{#if translatorPagesError}
					<div class="alert alert-error">
						<span>{translatorPagesError}</span>
					</div>
				{/if}
				{#if translatorPagesInfo}
					<div class="alert alert-success">
						<span>{translatorPagesInfo}</span>
					</div>
				{/if}

				<form
					method="POST"
					action="?/requestTranslatorPagesUpdate"
					use:enhance={createFormEnhance({
						onStart: () => {
							translatorPagesError = null;
							translatorPagesInfo = null;
						},
						onFailure: (message) => {
							translatorPagesError = message;
						},
						onSuccess: (result) => {
							translatorPagesInfo =
								typeof result.data === 'object' && result.data && 'message' in result.data
									? String(result.data.message)
									: translatorPagesWriteMode === 'direct'
										? 'Pages traducteur mises à jour.'
										: 'Demande envoyée. En attente de validation admin.';
						}
					})}
				>
					<input type="hidden" name="translatorId" value={linkedTranslator.id} />
					{#if roleEditMode === 'user_direct_mode'}
						<input type="hidden" name="directMode" value={directMode ? 'true' : 'false'} />
					{/if}
					<div class="space-y-2">
						{#each translatorPages as pageEntry, index (index)}
							<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
								<input
									type="text"
									placeholder="Nom de la page"
									class="input-bordered input flex-1"
									bind:value={pageEntry.name}
								/>
								<input
									type="url"
									placeholder="https://…"
									class="input-bordered input flex-1"
									bind:value={pageEntry.link}
								/>
								<button
									type="button"
									class="btn btn-sm btn-error shrink-0"
									onclick={() => removeTranslatorPage(index)}
									aria-label="Supprimer cette page"
								>
									✕
								</button>
							</div>
						{/each}
						{#if translatorPages.length === 0}
							<p class="text-sm text-base-content/70">
								Aucune page (la liste sera vide après validation).
							</p>
						{/if}
						<button type="button" class="btn btn-outline btn-sm" onclick={addTranslatorPage}>
							+ Ajouter une page
						</button>
					</div>
					<input type="hidden" name="pages" value={currentTranslatorPagesSignature} />
					<div class="mt-4 flex justify-end">
						<button type="submit" class="btn btn-primary" disabled={!hasTranslatorPagesChanges}>
							{translatorPagesWriteMode === 'direct'
								? hasTranslatorPagesChanges
									? 'Enregistrer les modifications'
									: 'Aucun changement'
								: hasTranslatorPagesChanges
									? 'Soumettre pour validation'
									: 'Aucun changement'}
						</button>
					</div>
				</form>
			</div>
		</div>
	{:else}
		<div role="alert" class="alert alert-info">
			<span>
				Aucune fiche traducteur n’est liée à ce compte : les pages externes apparaîtront une fois
				l’association faite par un administrateur.
			</span>
		</div>
	{/if}

	{#if profileCustomize.any}
		<div class="card border border-base-300 bg-base-100 shadow-sm">
			<div class="card-body gap-4">
				<h2 class="text-lg font-semibold text-base-content">Personnalisation</h2>
				<p class="text-sm text-base-content/70">
					Éléments modifiables sur votre
					<a href={publicProfileHref} class="link link-hover">profil public</a>
					(selon vos permissions).
				</p>

				{#if customProfileError}
					<div class="alert alert-error">
						<span>{customProfileError}</span>
					</div>
				{/if}
				{#if customProfileInfo}
					<div class="alert alert-success">
						<span>{customProfileInfo}</span>
					</div>
				{/if}

				<form
					method="POST"
					action="?/updateCustomProfile"
					use:enhance={createFormEnhance({
						onStart: () => {
							customProfileError = null;
							customProfileInfo = null;
						},
						onFailure: (message) => {
							customProfileError = message;
						},
						onSuccess: (result) => {
							customProfileInfo =
								typeof result.data === 'object' && result.data && 'message' in result.data
									? String(result.data.message)
									: 'Profil personnalisé mis à jour.';
						}
					})}
				>
					{#if profileCustomize.bio}
						<fieldset class="fieldset gap-2">
							<legend class="fieldset-legend">Bio</legend>
							<textarea
								name="profileBio"
								class="textarea textarea-bordered w-full"
								rows="5"
								maxlength={PROFILE_BIO_MAX_LENGTH}
								placeholder="Présentez-vous, vos spécialités, vos projets…"
								bind:value={profileBio}
							></textarea>
							<p class="label text-base-content/60">
								{profileBio.length}/{PROFILE_BIO_MAX_LENGTH} caractères
							</p>
						</fieldset>
					{:else}
						<input type="hidden" name="profileBio" value={profileBio} />
					{/if}

					{#if profileCustomize.background || profileCustomize.music || profileCustomize.cursor}
						<fieldset class="fieldset gap-3 {profileCustomize.bio ? 'mt-4' : ''}">
							<legend class="fieldset-legend">Apparence</legend>
							{#if profileCustomize.background}
								<label class="input flex w-full items-start">
									<span class="label h-full"
										>URL de l'image de fond ({PROFILE_BACKGROUND_SIZE_LABEL})</span
									>
									<input
										type="url"
										name="profileBackgroundUrl"
										class="grow w-full"
										placeholder="https://exemple.com/fond.jpg"
										bind:value={profileBackgroundUrl}
									/>
								</label>
							{:else}
								<input type="hidden" name="profileBackgroundUrl" value={profileBackgroundUrl} />
							{/if}
							{#if profileCustomize.music}
								<label class="input flex w-full items-start">
									<span class="label h-full">Musique (YouTube / YouTube Music)</span>
									<input
										type="url"
										name="profileMusicUrl"
										class="grow w-full"
										placeholder="https://music.youtube.com/watch?v=…"
										bind:value={profileMusicUrl}
									/>
								</label>
							{:else}
								<input type="hidden" name="profileMusicUrl" value={profileMusicUrl} />
							{/if}
							{#if profileCustomize.cursor}
								<label class="input flex w-full items-start">
									<span class="label h-full"
										>Curseur (URL image, affiché en {PROFILE_CURSOR_DISPLAY_PX}×{PROFILE_CURSOR_DISPLAY_PX}
										px)</span
									>
									<input
										type="url"
										name="profileCursorUrl"
										class="grow w-full"
										placeholder="https://exemple.com/curseur.png"
										bind:value={profileCursorUrl}
									/>
								</label>
							{:else}
								<input type="hidden" name="profileCursorUrl" value={profileCursorUrl} />
							{/if}
							{#if profileCustomize.background}
								<p class="text-xs text-base-content/60">
									Fond : JPG/PNG/WebP, ratio {PROFILE_BACKGROUND_SIZE_LABEL}. Un fondu vers le fond
									de la page est appliqué en bas de l’image sur le profil public.
								</p>
							{/if}
							{#if profileCustomize.music}
								<p class="text-xs text-base-content/60">
									Musique : lien morceau YouTube / YouTube Music.
								</p>
							{/if}
							{#if profileCustomize.cursor}
								<p class="text-xs text-base-content/60">
									Curseur : PNG transparent ; affichage {PROFILE_CURSOR_DISPLAY_PX} px.
								</p>
							{/if}
						</fieldset>
					{:else}
						<input type="hidden" name="profileBackgroundUrl" value={profileBackgroundUrl} />
						<input type="hidden" name="profileMusicUrl" value={profileMusicUrl} />
						<input type="hidden" name="profileCursorUrl" value={profileCursorUrl} />
					{/if}

					<div class="mt-4 flex justify-end">
						<button type="submit" class="btn btn-primary">Enregistrer</button>
					</div>
				</form>
			</div>
		</div>
	{:else if !linkedTranslator}
		<div role="alert" class="alert alert-info">
			<span>
				Aucune permission de personnalisation (bio, fond, musique, curseur). Demandez les droits
				appropriés à un administrateur dans
				<a href="/dashboard/roles" class="link link-hover">Rôles et permissions</a>.
			</span>
		</div>
	{/if}
</section>
