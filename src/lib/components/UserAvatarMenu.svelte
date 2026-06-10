<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { clearUserData, user } from '$lib/stores';
	import { resolveDiscordAvatarDisplayUrl } from '$lib/utils/discord-avatar-url';
	import { profilePublicHref } from '$lib/utils/profile-url';
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import LogOut from '@lucide/svelte/icons/log-out';
	import User from '@lucide/svelte/icons/user';
	import UserPen from '@lucide/svelte/icons/user-pen';

	interface Props {
		/** Classes sur le conteneur dropdown (ex. z-50). */
		class?: string;
	}

	let { class: className = '' }: Props = $props();
</script>

{#if $user}
	<div class="dropdown dropdown-end {className}">
		<div
			tabindex="0"
			role="button"
			class="btn avatar btn-circle btn-ghost"
			aria-label="Menu compte"
		>
			<div class="flex w-10 items-center justify-center rounded-full">
				{#if $user.avatar && $user.avatar !== ''}
					<img alt="" src={resolveDiscordAvatarDisplayUrl($user.avatar)} draggable="false" />
				{:else}
					<User />
				{/if}
			</div>
		</div>
		<ul
			tabindex="-1"
			class="dropdown-content menu z-50 mt-2 w-52 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
		>
			<li>
				<a href={resolve('/dashboard')} class="gap-2">
					<LayoutDashboard class="h-4 w-4" />
					Tableau de bord
				</a>
			</li>
			<li>
				<a href={resolve(profilePublicHref($user.username))} class="gap-2">
					<User class="h-4 w-4" />
					Profil
				</a>
			</li>
			<li>
				<a href={resolve('/dashboard/profile')} class="gap-2">
					<UserPen class="h-4 w-4" />
					Modifier le profil
				</a>
			</li>
			<li class="mt-1 border-t border-base-300 pt-1">
				<form
					method="POST"
					action={resolve('/dashboard/logout?/logout')}
					use:enhance={() => {
						return async ({ update }) => {
							clearUserData();
							await update();
						};
					}}
				>
					<a href={resolve('/dashboard/logout')} class="gap-2 text-error flex">
						<LogOut class="h-4 w-4" />
						Déconnexion
					</a>
				</form>
			</li>
		</ul>
	</div>
{/if}
