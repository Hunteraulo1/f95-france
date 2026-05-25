<script lang="ts">
	import ProfileStatsPanel from '$lib/components/dashboard/ProfileStats.svelte';
	import ProfileTranslations from '$lib/components/dashboard/ProfileTranslations.svelte';
	import YoutubeAudioPlayer from '$lib/components/dashboard/YoutubeAudioPlayer.svelte';
	import type { CustomProfileTheme, TranslatorPageLink } from '$lib/profile/custom-profile';
	import {
		PROFILE_BACKGROUND_HEIGHT,
		PROFILE_BACKGROUND_WIDTH,
		PROFILE_CURSOR_DISPLAY_PX
	} from '$lib/profile/custom-profile';
	import { extractYoutubeVideoId } from '$lib/profile/youtube-music';
	import type { ProfileStats } from '$lib/server/profile-stats';
	import type { ProfileTranslationItem } from '$lib/server/profile-translations';
	import { superadminBadgeClass, superadminUsernameClass } from '$lib/utils/username-display';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import User from '@lucide/svelte/icons/user';
	import UserPen from '@lucide/svelte/icons/user-pen';

	type ProfileUser = {
		username: string;
		avatar: string;
		role: string;
		createdAt: Date;
	};

	interface Props {
		user: ProfileUser;
		profileStats?: ProfileStats | null;
		customProfile?: CustomProfileTheme | null;
		translatorLinks?: TranslatorPageLink[];
		linkedTranslator?: { id: string; name: string } | null;
		translations?: ProfileTranslationItem[];
		translationsTotal?: number;
		translationsPage?: number;
		translationsTotalPages?: number;
		translationsHrefForPage?: (page: number) => string;
		editProfileHref?: string | null;
	}

	let {
		user,
		profileStats = null,
		customProfile = null,
		translatorLinks = [],
		linkedTranslator = null,
		translations = [],
		translationsTotal = 0,
		translationsPage = 1,
		translationsTotalPages = 1,
		translationsHrefForPage = () => '',
		editProfileHref = null
	}: Props = $props();

	let customCursorActive = $state(false);
	let customCursorX = $state(0);
	let customCursorY = $state(0);

	const musicVideoId = $derived(extractYoutubeVideoId(customProfile?.musicUrl));
	const hasCustomCursor = $derived(!!customProfile?.cursorUrl);
	const hasBackground = $derived(!!customProfile?.backgroundUrl);

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
	aria-label={`Profil de ${user.username}`}
	class="profile-theme-root relative flex w-full flex-col min-h-full overflow-hidden rounded-2xl border border-base-300 bg-base-100"
	class:profile-theme-root--with-bg={hasBackground}
	class:profile-theme-root--custom-cursor={hasCustomCursor}
	onmousemove={hasCustomCursor ? trackCustomCursor : undefined}
	onmouseenter={hasCustomCursor ? showCustomCursor : undefined}
	onmouseleave={hasCustomCursor ? hideCustomCursor : undefined}
>
	{#if hasBackground && customProfile?.backgroundUrl}
		<div class="profile-theme-hero min-h-96" aria-hidden="true">
			<img
				src={customProfile.backgroundUrl}
				alt=""
				class="profile-theme-hero__image"
				width={PROFILE_BACKGROUND_WIDTH}
				height={PROFILE_BACKGROUND_HEIGHT}
				referrerpolicy="no-referrer"
			/>
			<div class="profile-theme-hero-fade"></div>
		</div>
	{/if}

	<div class="profile-theme-body flex shrink-0 flex-col gap-8 p-4 md:flex-row md:p-6">
		<div
			class="profile-theme-sidebar flex flex-col gap-2 md:min-w-48"
			class:profile-theme-sidebar--with-bg={hasBackground}
		>
			<div
				class="flex h-32 w-32 items-center justify-center rounded-full bg-base-300 p-1 shadow-md"
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
			<h3 class="text-lg font-semibold {superadminUsernameClass(user.role)}">{user.username}</h3>
			{#if linkedTranslator}
				<p class="text-sm text-base-content/70">Traducteur : {linkedTranslator.name}</p>
			{/if}
			<span class="badge text-nowrap {superadminBadgeClass(user.role)}"
				>{roles[user.role] ?? user.role}</span
			>
			<p class="text-sm text-base-content/60">
				Membre depuis: {new Date(user.createdAt).toLocaleDateString('fr-FR')}
			</p>
			{#if editProfileHref}
				<a href={editProfileHref} class="btn btn-outline btn-sm w-fit gap-2">
					<UserPen class="h-4 w-4" />
					Modifier mon profil
				</a>
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
	</div>
</div>

<style>
	.profile-theme-root--with-bg .profile-theme-hero {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		z-index: 0;
		overflow: hidden;
		aspect-ratio: 5 / 3;
		pointer-events: none;
	}

	.profile-theme-root--with-bg .profile-theme-body {
		position: relative;
		z-index: 1;
	}

	.profile-theme-hero__image {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: top center;
	}

	.profile-theme-hero-fade {
		position: absolute;
		inset: 0;
		z-index: 1;
		background:
			linear-gradient(
				to right,
				var(--color-base-100) 0%,
				color-mix(in oklch, var(--color-base-100) 92%, transparent) 18%,
				color-mix(in oklch, var(--color-base-100) 50%, transparent) 42%,
				transparent 72%
			),
			linear-gradient(to bottom, transparent 0%, transparent 42%, var(--color-base-100) 100%);
	}

	.profile-theme-sidebar--with-bg {
		position: relative;
		z-index: 2;
	}

	.profile-theme-root--custom-cursor,
	.profile-theme-root--custom-cursor :global(*) {
		cursor: none !important;
	}

	.profile-custom-cursor {
		image-rendering: pixelated;
	}
</style>
