<script lang="ts">
	import { enhance } from '$app/forms';
	import { createFormEnhance } from '$lib/forms/enhance';
	import type { PermissionKey } from '$lib/permissions/catalog';
	import { permissionGranted } from '$lib/permissions/check';
	import BookType from '@lucide/svelte/icons/book-type';
	import Box from '@lucide/svelte/icons/box';
	import BrickWallShield from '@lucide/svelte/icons/brick-wall-shield';
	import CornerUpLeft from '@lucide/svelte/icons/corner-up-left';
	import Inbox from '@lucide/svelte/icons/inbox';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import Languages from '@lucide/svelte/icons/languages';
	import Library from '@lucide/svelte/icons/library';
	import LogOut from '@lucide/svelte/icons/log-out';
	import MonitorCog from '@lucide/svelte/icons/monitor-cog';
	import ScrollText from '@lucide/svelte/icons/scroll-text';
	import Settings from '@lucide/svelte/icons/settings';
	import Settings2 from '@lucide/svelte/icons/settings-2';
	import Shield from '@lucide/svelte/icons/shield';
	import UserPen from '@lucide/svelte/icons/user-pen';
	import Users from '@lucide/svelte/icons/users';
	import type { Component } from 'svelte';
	import { onMount } from 'svelte';

	interface Props {
		pendingSubmissionsCount?: number;
		hasLinkedTranslator?: boolean;
		canReturnToOwnAccount?: boolean;
		devOriginUsername?: string | null;
		permissions?: string[];
		userRole?: string | null;
		hasUser?: boolean;
	}

	let {
		pendingSubmissionsCount = 0,
		hasLinkedTranslator = false,
		canReturnToOwnAccount = false,
		devOriginUsername = null,
		permissions = [],
		userRole = null,
		hasUser = false
	}: Props = $props();
	let isDrawerOpen = $state(true);
	let returnUserError = $state<string | null>(null);

	const isDesktop = () => window.matchMedia('(min-width: 840px)').matches;

	onMount(() => {
		const desktopMediaQuery = window.matchMedia('(min-width: 840px)');

		isDrawerOpen = desktopMediaQuery.matches;

		const handleBreakpointChange = (event: MediaQueryListEvent) => {
			// Keep burger closed by default when entering mobile viewport.
			isDrawerOpen = event.matches;
		};

		desktopMediaQuery.addEventListener('change', handleBreakpointChange);

		return () => {
			desktopMediaQuery.removeEventListener('change', handleBreakpointChange);
		};
	});

	/** Après le clic : la navigation du `<a>` doit s'exécuter avant de muter l'état du drawer, sinon Svelte peut re-render et retirer le lien avant l'action par défaut (navigation SPA bloquée, F5 « répare »). */
	const closeDrawerOnMobile = () => {
		if (!isDesktop()) {
			setTimeout(() => {
				isDrawerOpen = false;
			}, 0);
		}
	};

	type NavAccess = 'all' | PermissionKey;

	interface NavItem {
		label: string;
		href: string;
		icon: Component;
		access: NavAccess;
		badge?: number;
		badgeKey?: boolean;
		requiresLinkedTranslator?: boolean;
	}

	interface NavItemSplit {
		split: true;
		access: NavAccess;
	}

	const canAccessNav = (access: NavAccess) => {
		if (access === 'all') return true;
		return permissionGranted(userRole, permissions, access);
	};

	const nav: (NavItem | NavItemSplit)[] = [
		{
			label: 'Tableau de bord',
			href: '/dashboard/',
			icon: MonitorCog,
			access: 'all'
		},
		{
			label: 'Gestion des jeux',
			href: '/dashboard/manager',
			icon: Library,
			access: 'games.manage'
		},
		{
			label: 'Mes traductions',
			href: '/dashboard/my-translations',
			icon: BookType,
			access: 'translations.own',
			requiresLinkedTranslator: true
		},
		{
			label: 'Mes soumissions',
			href: '/dashboard/my-submits',
			icon: Inbox,
			access: 'submissions.own'
		},
		{
			label: 'Soumissions',
			href: '/dashboard/submits',
			icon: Box,
			access: 'submissions.review',
			badgeKey: true
		},
		{
			label: 'Traducteurs/Relecteurs',
			href: '/dashboard/translators',
			icon: Languages,
			access: 'translators.manage'
		},
		{
			split: true,
			access: 'users.manage'
		},
		{
			label: 'Utilisateurs',
			href: '/dashboard/users',
			icon: Users,
			access: 'users.manage'
		},
		{
			label: 'Rôles et droits',
			href: '/dashboard/roles',
			icon: Shield,
			access: 'roles.manage'
		},
		{
			label: 'Gestion API',
			href: '/dashboard/api-management',
			icon: KeyRound,
			access: 'api.management'
		},
		{
			label: 'Configuration',
			href: '/dashboard/config',
			icon: Settings,
			access: 'config.view'
		},
		{
			label: 'Logs',
			href: '/dashboard/logs',
			icon: ScrollText,
			access: 'logs.view'
		},
		{
			label: 'Panel développeur',
			href: '/dashboard/dev',
			icon: BrickWallShield,
			access: 'dev.panel'
		},
		{
			split: true,
			access: 'all'
		},
		{
			label: 'Mes clés API',
			href: '/dashboard/api-keys',
			icon: KeyRound,
			access: 'all'
		},
		{
			label: 'Personnaliser le profil',
			href: '/dashboard/profile',
			icon: UserPen,
			access: 'all'
		},
		{
			label: 'Paramètres',
			href: '/dashboard/settings',
			icon: Settings2,
			access: 'all'
		},
		{
			label: 'Déconnexion',
			href: '/dashboard/account/logout',
			icon: LogOut,
			access: 'all'
		}
	];

	const canShowNavItem = (item: NavItem) => {
		if (item.requiresLinkedTranslator && !hasLinkedTranslator) return false;
		return true;
	};
</script>

<input id="my-drawer-4" type="checkbox" class="drawer-toggle" bind:checked={isDrawerOpen} />

<aside class="drawer-side max-h-[calc(100vh-4rem)] is-drawer-close:overflow-visible">
	<label for="my-drawer-4" aria-label="close sidebar" class="drawer-overlay"></label>
	<div
		class="flex min-h-full flex-col items-start bg-base-100 max-md:w-64 is-drawer-close:w-14 is-drawer-open:w-64"
	>
		<!-- Sidebar content here -->
		<ul class="menu w-full grow">
			{#each nav as item, index ('split' in item ? `split-${index}` : item.href || item.label || `item-${index}`)}
				{#if hasUser && canAccessNav(item.access)}
					{#if 'split' in item}
						<div class="divider"></div>
					{:else if canShowNavItem(item)}
						{@const IconComponent = item.icon}

						<li>
							<a
								class="flex h-8 items-center font-semibold is-drawer-close:tooltip is-drawer-close:tooltip-right"
								class:text-red-400={item.href === '/dashboard/account/logout'}
								data-tip={item.label}
								href={item.href}
								onclick={closeDrawerOnMobile}
							>
								<IconComponent size={16} />
								<span class="leading-4 text-nowrap is-drawer-close:hidden">
									{item.label}
									{#if item.badgeKey && pendingSubmissionsCount > 0}
										<div class="ml-1 badge badge-xs badge-warning">
											{pendingSubmissionsCount > 99 ? '99+' : pendingSubmissionsCount}
										</div>
									{/if}
								</span>
							</a>
						</li>
					{/if}
				{/if}
			{/each}
			{#if canReturnToOwnAccount}
				<div class="divider"></div>
				<li>
					<form
						method="POST"
						action="/dashboard/settings?/returnToOwnAccount"
						class="w-full"
						use:enhance={createFormEnhance({
							updateOnlyOnSuccess: true,
							onStart: () => {
								returnUserError = null;
							},
							onSuccess: () => {
								window.location.href = '/dashboard';
							},
							onFailure: (message) => {
								returnUserError = message;
							}
						})}
					>
						<button
							type="submit"
							class="flex h-8 gap-2 w-full items-center font-semibold text-secondary is-drawer-close:tooltip is-drawer-close:tooltip-right"
							data-tip={devOriginUsername
								? `Revenir à ${devOriginUsername}`
								: 'Revenir à mon compte'}
						>
							<CornerUpLeft size={16} />
							<span class="leading-4 text-nowrap is-drawer-close:hidden">
								Revenir à mon compte
							</span>
						</button>
					</form>
					{#if returnUserError}
						<p class="px-4 text-xs text-error is-drawer-close:hidden">{returnUserError}</p>
					{/if}
				</li>
			{/if}
		</ul>
	</div>
</aside>
