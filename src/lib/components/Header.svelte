<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import BannerLogo from '$lib/components/BannerLogo.svelte';
	import UserAvatarMenu from '$lib/components/UserAvatarMenu.svelte';
	import { clearUserData, user } from '$lib/stores';
	import { resolveDiscordAvatarDisplayUrl } from '$lib/utils/discord-avatar-url';
	import { profilePublicHref } from '$lib/utils/profile-url';
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Menu from '@lucide/svelte/icons/menu';
	import User from '@lucide/svelte/icons/user';
	import UserPen from '@lucide/svelte/icons/user-pen';
	import X from '@lucide/svelte/icons/x';

	const NAV_DRAWER_ID = 'public-site-nav-drawer';

	interface Link {
		label: string;
		href: string;
		target?: string;
	}

	const links: Link[] = [
		{ label: 'Accueil', href: resolve('/') },
		{ label: 'Jeux', href: resolve('/games') },
		{ label: 'Mises à jour', href: '/updates' },
		{ label: 'Traducteurs', href: '/translators' }
		// TODO: Uncomment when Wiki is back online
		// { label: 'Wiki', href: 'https://wiki.f95france.site', target: '_blank' }
	];

	let navDrawerOpen = $state(false);

	const closeNavDrawer = () => {
		navDrawerOpen = false;
	};

	const isCurrentPath = (href: string) => {
		if (href === resolve('/')) return page.url.pathname === '/';
		return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
	};

	const navLinkClass = (href: string) =>
		`btn justify-start font-semibold ${isCurrentPath(href) ? 'btn-primary' : 'btn-ghost'}`;
</script>

<div class="drawer drawer-end w-full">
	<input id={NAV_DRAWER_ID} type="checkbox" class="drawer-toggle" bind:checked={navDrawerOpen} />

	<div class="drawer-content w-full min-w-0">
		<div class="navbar z-10 h-32 items-center gap-4 px-8 sm:px-12">
			<div class="navbar-start w-full">
				<a href={resolve('/')} class="py-10" draggable="false">
					<BannerLogo class="h-4 xs:h-6 sm:h-8 md:h-10 lg:h-10 w-auto object-contain" />
				</a>
			</div>

			<div class="navbar-end gap-2 w-full">
				<label for={NAV_DRAWER_ID} class="btn btn-ghost px-2 lg:hidden" aria-label="Ouvrir le menu">
					<Menu class="h-6 w-6" />
				</label>

				<ul class="hidden items-center gap-2 lg:flex xl:gap-4 flex-nowrap text-nowrap">
					{#each links as link (link.href)}
						<li aria-current={isCurrentPath(link.href) ? 'page' : undefined}>
							<a
								href={link.href}
								class="btn border-0 text-sm font-semibold shadow-none hover:bg-transparent hover:text-secondary aria-[current=page]:text-primary"
								draggable="false"
								target={link.target}
							>
								{link.label}
							</a>
						</li>
					{/each}
					{#if $user}
						<li>
							<UserAvatarMenu class="z-50" />
						</li>
					{:else}
						<li>
							<a
								aria-current={page.url.pathname === '/dashboard/account/login' ? 'page' : undefined}
								href={resolve('/dashboard/account/login')}
								class="btn w-28 rounded-md p-2 text-sm font-semibold shadow-lg {page.url
									.pathname === '/dashboard/account/login'
									? 'btn-primary'
									: 'btn-outline btn-primary'}"
								draggable="false"
							>
								Connexion
							</a>
						</li>
						<li>
							<a
								aria-current={page.url.pathname === '/dashboard/account/register'
									? 'page'
									: undefined}
								href={resolve('/dashboard/account/register')}
								class="btn btn-primary w-28 rounded-md border-base-content/10 p-2 text-sm font-semibold shadow-lg hover:text-primary-content aria-[current=page]:bg-primary aria-[current=page]:text-primary-content"
								draggable="false"
							>
								Inscription
							</a>
						</li>
					{/if}
				</ul>
			</div>
		</div>
	</div>

	<div class="drawer-side z-50">
		<label for={NAV_DRAWER_ID} class="drawer-overlay" aria-label="Fermer le menu"></label>
		<nav
			class="flex min-h-full w-72 max-w-[85vw] flex-col gap-4 bg-base-100 p-4 text-base-content shadow-xl"
			aria-label="Navigation principale"
		>
			<div class="flex items-center justify-between gap-2">
				<span class="text-lg font-bold">Menu</span>
				<label
					for={NAV_DRAWER_ID}
					class="btn btn-circle btn-ghost btn-sm"
					aria-label="Fermer le menu"
				>
					<X class="h-5 w-5" />
				</label>
			</div>

			<ul class="menu flex-1 gap-1 p-0">
				{#each links as link (link.href)}
					<li>
						<a
							href={link.href}
							class={navLinkClass(link.href)}
							aria-current={isCurrentPath(link.href) ? 'page' : undefined}
							onclick={closeNavDrawer}
						>
							{link.label}
						</a>
					</li>
				{/each}
			</ul>

			<div class="flex flex-col gap-2 border-t border-base-300 pt-4">
				{#if $user}
					<div class="flex items-center gap-3 px-2 py-1">
						<div class="avatar placeholder">
							<div class="flex w-10 items-center justify-center rounded-full bg-base-300">
								{#if $user.avatar}
									<img
										alt=""
										src={resolveDiscordAvatarDisplayUrl($user.avatar)}
										class="rounded-full"
									/>
								{:else}
									<User class="h-5 w-5" />
								{/if}
							</div>
						</div>
						<span class="truncate font-semibold">{$user.username}</span>
					</div>
					<a
						href={resolve('/dashboard')}
						class="btn btn-ghost justify-start gap-2"
						onclick={closeNavDrawer}
					>
						<LayoutDashboard class="h-4 w-4" />
						Tableau de bord
					</a>
					<a
						href={resolve(profilePublicHref($user.username))}
						class="btn btn-ghost justify-start gap-2"
						onclick={closeNavDrawer}
					>
						<User class="h-4 w-4" />
						Profil
					</a>
					<a
						href={resolve('/dashboard/profile')}
						class="btn btn-ghost justify-start gap-2"
						onclick={closeNavDrawer}
					>
						<UserPen class="h-4 w-4" />
						Modifier le profil
					</a>
					<form
						method="POST"
						action={resolve('/dashboard/account/logout?/logout')}
						use:enhance={() => {
							return async ({ update }) => {
								clearUserData();
								closeNavDrawer();
								await update();
							};
						}}
					>
						<button type="submit" class="btn btn-ghost justify-start gap-2 text-error w-full">
							<LogOut class="h-4 w-4" />
							Déconnexion
						</button>
					</form>
				{:else}
					<a
						href={resolve('/dashboard/account/login')}
						class="btn w-full {page.url.pathname === '/dashboard/account/login'
							? 'btn-primary'
							: 'btn-outline btn-primary'}"
						onclick={closeNavDrawer}
					>
						Connexion
					</a>
					<a
						href={resolve('/dashboard/account/register')}
						class="btn btn-primary w-full"
						onclick={closeNavDrawer}
					>
						Inscription
					</a>
				{/if}
			</div>
		</nav>
	</div>
</div>
