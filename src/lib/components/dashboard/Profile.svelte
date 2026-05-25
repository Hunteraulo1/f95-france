<script lang="ts">
	import { enhance } from '$app/forms';
	import ProfileStatsPanel from '$lib/components/dashboard/ProfileStats.svelte';
	import ProfileTranslations from '$lib/components/dashboard/ProfileTranslations.svelte';
	import type { CustomProfileTheme, TranslatorPageLink } from '$lib/profile/custom-profile';
	import { PROFILE_BIO_MAX_LENGTH, PROFILE_CURSOR_DISPLAY_PX } from '$lib/profile/custom-profile';
	import { extractYoutubeVideoId } from '$lib/profile/youtube-music';
	import type { ProfileStats } from '$lib/server/profile-stats';
	import type { ProfileTranslationItem } from '$lib/server/profile-translations';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import User from '@lucide/svelte/icons/user';
	import YoutubeAudioPlayer from './YoutubeAudioPlayer.svelte';

	type ProfileUser = {
		id: string;
		username: string;
		avatar: string;
		role: string;
		createdAt: Date;
		discordId?: string | null;
	};

	interface Props {
		user: ProfileUser | null;
		email?: string | null;
		profileStats?: ProfileStats | null;
		customProfile?: CustomProfileTheme | null;
		translatorLinks?: TranslatorPageLink[];
		linkedTranslator?: { id: string; name: string } | null;
		translations?: ProfileTranslationItem[];
		translationsTotal?: number;
		translationsPage?: number;
		translationsTotalPages?: number;
		translationsHrefForPage?: (page: number) => string;
		canCustomizeProfile?: boolean;
		/** Lien vers la page profil publique (ex. /dashboard/profile/{id}). */
		publicProfileHref?: string | null;
	}

	let {
		user,
		email,
		profileStats = null,
		customProfile = null,
		translatorLinks = [],
		linkedTranslator = null,
		translations = [],
		translationsTotal = 0,
		translationsPage = 1,
		translationsTotalPages = 1,
		translationsHrefForPage = () => '',
		canCustomizeProfile = false,
		publicProfileHref = null
	}: Props = $props();

	let profileBio = $state('');
	let profileBackgroundUrl = $state('');
	let profileMusicUrl = $state('');
	let profileCursorUrl = $state('');
	let customProfileError = $state<string | null>(null);
	let customProfileInfo = $state<string | null>(null);
	let customCursorActive = $state(false);
	let customCursorX = $state(0);
	let customCursorY = $state(0);

	const musicVideoId = $derived(extractYoutubeVideoId(customProfile?.musicUrl));
	const hasCustomCursor = $derived(!!customProfile?.cursorUrl);

	const trackCustomCursor = (event: MouseEvent) => {
		customCursorX = event.clientX;
		customCursorY = event.clientY;
	};

	const showCustomCursor = () => {
		customCursorActive = true;
	};

	const hideCustomCursor = () => {
		customCursorActive = false;
	};

	$effect(() => {
		if (canCustomizeProfile && customProfile) {
			profileBio = customProfile.bio;
			profileBackgroundUrl = customProfile.backgroundUrl ?? '';
			profileMusicUrl = customProfile.musicUrl ?? '';
			profileCursorUrl = customProfile.cursorUrl ?? '';
		}
	});

	const roles: Record<string, string> = {
		user: 'Utilisateur',
		admin: 'Administrateur',
		translator: 'Traducteur',
		superadmin: 'Super Admin'
	};
</script>

{#if hasCustomCursor && customCursorActive && customProfile?.cursorUrl}
	<img
		src={customProfile.cursorUrl}
		alt=""
		class="profile-custom-cursor pointer-events-none fixed z-9999 object-contain"
		style="left: {customCursorX}px; top: {customCursorY}px; width: {PROFILE_CURSOR_DISPLAY_PX}px; height: {PROFILE_CURSOR_DISPLAY_PX}px; transform: translate(-50%, -50%);"
		referrerpolicy="no-referrer"
		aria-hidden="true"
	/>
{/if}

<div
	role="region"
	aria-label={user ? `Profil de ${user.username}` : 'Profil utilisateur'}
	class="profile-theme-root relative overflow-hidden rounded-2xl border border-base-300 min-h-full bg-cover bg-center"
	class:profile-theme-root--bg={!!customProfile?.backgroundUrl}
	class:profile-theme-root--custom-cursor={hasCustomCursor}
	onmousemove={hasCustomCursor ? trackCustomCursor : undefined}
	onmouseenter={hasCustomCursor ? showCustomCursor : undefined}
	onmouseleave={hasCustomCursor ? hideCustomCursor : undefined}
>
	{#if customProfile?.backgroundUrl}
		<img
			src={customProfile.backgroundUrl}
			alt=""
			class="profile-theme-bg-image min-h-full pointer-events-none absolute inset-0 h-full w-full object-cover"
			referrerpolicy="no-referrer"
			aria-hidden="true"
		/>
		<div
			class="pointer-events-none absolute inset-0 bg-base-100/45 backdrop-blur-[1px]"
			aria-hidden="true"
		></div>
	{/if}

	<div class="relative z-1 flex flex-col gap-8 h-full p-4 md:flex-row md:p-6">
		{#if user}
			<div class="flex flex-col gap-2 md:min-w-48">
				<div
					class="flex h-32 w-32 items-center justify-center rounded-full bg-base-300 p-4 shadow-md"
				>
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
				{#if linkedTranslator}
					<p class="text-sm text-base-content/70">Traducteur : {linkedTranslator.name}</p>
				{/if}
				{#if email}
					<p>{email}</p>
				{/if}
				<span class="badge text-nowrap">{roles[user.role] ?? user.role}</span>
				<p class="text-sm text-base-content/60">
					Membre depuis: {user?.createdAt
						? new Date(user.createdAt).toLocaleDateString('fr-FR')
						: '—'}
				</p>
				{#if publicProfileHref}
					<a href={publicProfileHref} class="btn btn-outline btn-sm w-fit"> Voir mon profil </a>
				{/if}
				{#if musicVideoId && customProfile?.musicUrl}
					<YoutubeAudioPlayer videoId={musicVideoId} />
				{/if}
			</div>

			<div class="mb-8 flex w-full h-full min-w-0 flex-col gap-4">
				{#if customProfile?.bio}
					<div class="card border border-base-300 bg-base-100/95 shadow-sm">
						<div class="card-body gap-2">
							<h4 class="card-title text-base">À propos</h4>
							<p class="whitespace-pre-wrap text-base-content/90">{customProfile.bio}</p>
						</div>
					</div>
				{/if}

				{#if translatorLinks.length > 0}
					<div class="card border border-base-300 bg-base-100/95 shadow-sm">
						<div class="card-body gap-2">
							<h4 class="card-title text-base">Pages traducteur</h4>
							<ul class="flex flex-col gap-2">
								{#each translatorLinks as link, i (`${i}-${link.url}`)}
									<li>
										<a
											href={link.url}
											target="_blank"
											rel="noopener noreferrer"
											class="link link-primary inline-flex items-center gap-1"
										>
											{link.label}
											<ExternalLink class="h-4 w-4" />
										</a>
									</li>
								{/each}
							</ul>
							{#if canCustomizeProfile && linkedTranslator}
								<p class="text-sm text-base-content/60">
									Les liens se modifient dans
									<a href="/dashboard/settings" class="link link-hover">Paramètres</a>
									(section « Mes pages traducteur »).
								</p>
							{/if}
						</div>
					</div>
				{:else if canCustomizeProfile && !linkedTranslator}
					<div class="alert alert-info bg-base-100/95">
						<span
							>Aucun profil traducteur lié : les pages externes s’affichent une fois le compte
							associé à une fiche traducteur.</span
						>
					</div>
				{/if}

				{#if canCustomizeProfile}
					<div class="card border border-primary/30 bg-base-100/95 shadow-sm">
						<div class="card-body gap-4">
							<h4 class="card-title text-base">Personnalisation du profil</h4>
							<p class="text-sm text-base-content/70">
								Fond, musique et curseur s’appliquent sur votre page de profil. Les liens restent
								ceux du traducteur associé.
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
								use:enhance={() => {
									customProfileError = null;
									customProfileInfo = null;
									return async ({ result, update }) => {
										if (result.type === 'success') {
											await update();
											customProfileInfo =
												typeof result.data === 'object' && result.data && 'message' in result.data
													? String(result.data.message)
													: 'Profil personnalisé mis à jour.';
										} else if (result.type === 'failure' && result.data) {
											customProfileError =
												typeof result.data === 'object' && 'message' in result.data
													? String(result.data.message)
													: 'Erreur lors de la mise à jour.';
										}
									};
								}}
							>
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

								<fieldset class="fieldset mt-4 gap-3">
									<legend class="fieldset-legend">Apparence</legend>
									<label class="input flex w-full items-start">
										<span class="label h-full">Image de fond (URL)</span>
										<input
											type="url"
											name="profileBackgroundUrl"
											class="grow w-full"
											placeholder="https://exemple.com/fond.jpg"
											bind:value={profileBackgroundUrl}
										/>
									</label>
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
									<p class="text-xs text-base-content/60">
										Fond : JPG/PNG/WebP. Musique : lien morceau YouTube / YouTube Music. Curseur :
										PNG avec fond transparent ; taille d’affichage fixe {PROFILE_CURSOR_DISPLAY_PX} px.
									</p>
								</fieldset>

								<div class="mt-4 flex justify-end">
									<button type="submit" class="btn btn-primary">Enregistrer</button>
								</div>
							</form>
						</div>
					</div>
				{/if}

				{#if profileStats && (profileStats.direct.gamesAdded > 0 || profileStats.direct.gamesEdited > 0 || profileStats.submissions.total > 0)}
					<ProfileStatsPanel stats={profileStats} />
				{/if}

				{#if linkedTranslator || translations.length > 0 || translationsTotal > 0 || profileStats?.translations}
					<ProfileTranslations
						{translations}
						totalCount={translationsTotal}
						page={translationsPage}
						totalPages={translationsTotalPages}
						hrefForPage={translationsHrefForPage}
						translationStats={profileStats?.translations ?? null}
						translatorName={linkedTranslator?.name}
					/>
				{/if}
			</div>
		{:else}
			<p>Chargement des données utilisateur...</p>
		{/if}
	</div>
</div>

<style>
	.profile-theme-root--bg {
		min-height: 16rem;
	}

	.profile-theme-bg-image {
		z-index: 0;
	}

	.profile-theme-root--custom-cursor,
	.profile-theme-root--custom-cursor :global(*) {
		cursor: none !important;
	}

	.profile-custom-cursor {
		image-rendering: pixelated;
	}
</style>
