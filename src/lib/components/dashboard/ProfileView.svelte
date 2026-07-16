<script lang="ts">
	import MarkdownContent from '$lib/components/MarkdownContent.svelte';
	import ProfileStatsPanel from '$lib/components/dashboard/ProfileStats.svelte';
	import ProfileTranslations from '$lib/components/dashboard/ProfileTranslations.svelte';
	import YoutubeAudioPlayer from '$lib/components/dashboard/YoutubeAudioPlayer.svelte';
	import { parseMarkdownDocument } from '$lib/markdown/content';
	import type { CustomProfileTheme, TranslatorPageLink } from '$lib/profile/custom-profile';
	import {
		PROFILE_BACKGROUND_HEIGHT,
		PROFILE_BACKGROUND_WIDTH,
		PROFILE_CURSOR_DISPLAY_PX
	} from '$lib/profile/custom-profile';
	import { extractYoutubeVideoId } from '$lib/profile/youtube-music';
	import type { ProfileStats } from '$lib/server/profile-stats';
	import type { ProfileTranslationItem } from '$lib/server/profile-translations';
	import { roleBadgeStyles } from '$lib/stores';
	import { resolveDiscordAvatarDisplayUrl } from '$lib/utils/discord-avatar-url';
	import { roleBadgeClass, roleUsernameClass } from '$lib/utils/role-display';
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
		translationsApiPath?: string;
		editProfileHref?: string | null;
		musicUrl?: string | null;
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
		translationsApiPath = '',
		editProfileHref = null,
		musicUrl = null
	}: Props = $props();

	let customCursorActive = $state(false);
	let customCursorX = $state(0);
	let customCursorY = $state(0);

	const musicVideoId = $derived(extractYoutubeVideoId(musicUrl ?? customProfile?.musicUrl ?? null));
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

	const bioDocument = $derived(customProfile?.bio ? parseMarkdownDocument(customProfile.bio) : []);
</script>

{#if hasCustomCursor && customCursorActive && customProfile?.cursorUrl}
	<img
		src={customProfile.cursorUrl}
		alt=""
		class="pointer-events-none fixed z-9999 object-contain [image-rendering:pixelated]"
		style="left: {customCursorX}px; top: {customCursorY}px; width: {PROFILE_CURSOR_DISPLAY_PX}px; height: {PROFILE_CURSOR_DISPLAY_PX}px; transform: translate(-50%, -50%);"
		referrerpolicy="no-referrer"
		aria-hidden="true"
	/>
{/if}

<div
	role="region"
	aria-label={`Profil de ${user.username}`}
	class={[
		'relative flex min-h-[calc(100vh-14rem)] w-full flex-col overflow-hidden rounded-2xl border border-base-300 bg-base-100',
		hasCustomCursor && 'cursor-none **:cursor-none!'
	]}
	onmousemove={hasCustomCursor ? trackCustomCursor : undefined}
	onmouseenter={hasCustomCursor ? showCustomCursor : undefined}
	onmouseleave={hasCustomCursor ? hideCustomCursor : undefined}
>
	{#if hasBackground && customProfile?.backgroundUrl}
		<div
			class="pointer-events-none absolute top-0 right-0 left-0 z-0 aspect-5/3 min-h-96 overflow-hidden"
			aria-hidden="true"
		>
			<img
				src={customProfile.backgroundUrl}
				alt=""
				class="absolute inset-0 block h-full w-full object-cover object-top"
				width={PROFILE_BACKGROUND_WIDTH}
				height={PROFILE_BACKGROUND_HEIGHT}
				referrerpolicy="no-referrer"
			/>
			<div
				class="absolute inset-0 z-1 bg-[linear-gradient(to_right,var(--color-base-100)_0%,color-mix(in_oklch,var(--color-base-100)_92%,transparent)_18%,color-mix(in_oklch,var(--color-base-100)_50%,transparent)_42%,transparent_72%),linear-gradient(to_bottom,transparent_0%,transparent_42%,var(--color-base-100)_100%)]"
				aria-hidden="true"
			></div>
		</div>
	{/if}

	<div class="relative z-1 flex shrink-0 flex-col gap-8 p-4 md:flex-row md:p-6">
		<div class={['flex flex-col gap-2 md:min-w-48', hasBackground && 'relative z-2']}>
			<div
				class="flex h-32 w-32 items-center justify-center rounded-full bg-base-300 p-1 shadow-md"
			>
				{#if user.avatar && user.avatar !== ''}
					<img
						src={resolveDiscordAvatarDisplayUrl(user.avatar)}
						alt="Avatar de {user.username}"
						class="h-full w-full rounded-full object-cover"
					/>
				{:else}
					<User size={64} />
				{/if}
			</div>
			<h3 class="text-lg font-semibold {roleUsernameClass(user.role, $roleBadgeStyles[user.role])}">
				{user.username}
			</h3>
			{#if linkedTranslator}
				<p class="text-sm text-base-content/70">Traducteur : {linkedTranslator.name}</p>
			{/if}
			<span class="badge text-nowrap {roleBadgeClass(user.role, $roleBadgeStyles[user.role])}"
				>{roles[user.role] ?? user.role}</span
			>
			<p class="text-sm text-base-content/60">
				Membre depuis: {new Date(user.createdAt).toLocaleDateString('fr-FR')}
			</p>
			{#if editProfileHref}
				<a href={editProfileHref} class="btn w-fit gap-2 btn-outline btn-sm">
					<UserPen class="h-4 w-4" />
					Modifier mon profil
				</a>
			{/if}
			{#if musicVideoId}
				<YoutubeAudioPlayer videoId={musicVideoId} />
			{/if}
		</div>

		<div class="mb-8 flex h-full w-full min-w-0 flex-col gap-4">
			{#if customProfile?.bio}
				<div class="card border border-base-300 bg-base-100/95 shadow-sm">
					<div class="card-body gap-2">
						<h4 class="card-title text-base">À propos</h4>
						<MarkdownContent document={bioDocument} variant="profile" />
					</div>
				</div>
			{/if}

			{#if translatorLinks.length > 0}
				<div class="card border border-base-300 bg-base-100/95 shadow-sm">
					<div class="card-body gap-2">
						<h4 class="card-title text-base">Pages traducteur</h4>
						<ul class="flex flex-col gap-2">
							{#each translatorLinks as link, i (`${i}-${link.url}`)}
								<li
									class={i === 0
										? 'rounded-lg border border-primary/40 bg-primary/5 px-3 py-2'
										: ''}
								>
									<a
										href={link.url}
										target="_blank"
										rel="noopener noreferrer"
										class="inline-flex link flex-wrap items-center gap-2 link-primary"
									>
										{#if i === 0}
											<span class="badge badge-sm badge-primary">Lien principal</span>
										{/if}
										<span>{link.label}</span>
										<ExternalLink class="h-4 w-4 shrink-0" />
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
					{translationsApiPath}
					translationStats={profileStats?.translations ?? null}
					translatorName={linkedTranslator?.name}
				/>
			{/if}
		</div>
	</div>
</div>
