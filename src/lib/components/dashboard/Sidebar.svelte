<script lang="ts">
	import { user } from '$lib/stores';
	import { checkRole, type checkRoleType } from '$lib/utils';
	import Box from '@lucide/svelte/icons/box';
	import BrickWallShield from '@lucide/svelte/icons/brick-wall-shield';
	import Inbox from '@lucide/svelte/icons/inbox';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import Languages from '@lucide/svelte/icons/languages';
	import Library from '@lucide/svelte/icons/library';
	import LogOut from '@lucide/svelte/icons/log-out';
	import MonitorCog from '@lucide/svelte/icons/monitor-cog';
	import ScrollText from '@lucide/svelte/icons/scroll-text';
	import Settings from '@lucide/svelte/icons/settings';
	import Settings2 from '@lucide/svelte/icons/settings-2';
	import UserPen from '@lucide/svelte/icons/user-pen';
	import Users from '@lucide/svelte/icons/users';
	import type { Component } from 'svelte';
	import { onMount } from 'svelte';

	interface Props {
		pendingSubmissionsCount?: number;
	}

	let { pendingSubmissionsCount = 0 }: Pick<Props, 'pendingSubmissionsCount'> = $props();
	let isDrawerOpen = $state(true);

	const isDesktop = () => window.matchMedia('(min-width: 640px)').matches;

	onMount(() => {
		const desktopMediaQuery = window.matchMedia('(min-width: 640px)');

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

	function closeDrawerOnMobile() {
		if (!isDesktop()) {
			isDrawerOpen = false;
		}
	}

	interface NavItem {
		label: string;
		href: string;
		icon: Component;
		roles: checkRoleType[];
		badge?: number;
		badgeKey?: boolean;
	}

	interface NavItemSplit {
		split: true;
		roles: checkRoleType[];
	}

	const nav: (NavItem | NavItemSplit)[] = [
		{
			label: 'Tableau de bord',
			href: '/dashboard/',
			icon: MonitorCog,
			roles: ['all']
		},
		{
			label: 'Gestion des jeux',
			href: '/dashboard/manager',
			icon: Library,
			roles: ['translator', 'admin']
		},
		{
			label: 'Mes soumissions',
			href: '/dashboard/submit',
			icon: Inbox,
			roles: ['translator']
		},
		{
			label: 'Soumissions',
			href: '/dashboard/submits',
			icon: Box,
			roles: ['admin'],
			badgeKey: true
		},
		{
			label: 'Traducteurs/Relecteurs',
			href: '/dashboard/translators',
			icon: Languages,
			roles: ['admin']
		},
		{
			split: true,
			roles: ['admin']
		},
		{
			label: 'Utilisateurs',
			href: '/dashboard/users',
			icon: Users,
			roles: ['admin']
		},
		{
			label: 'Clés API (admin)',
			href: '/dashboard/admin/api-keys',
			icon: KeyRound,
			roles: ['admin']
		},
		{
			label: 'Configuration',
			href: '/dashboard/config',
			icon: Settings,
			roles: ['superadmin']
		},
		{
			label: 'Logs API',
			href: '/dashboard/logs',
			icon: ScrollText,
			roles: ['superadmin']
		},
		{
			label: 'Panel développeur',
			href: '/dashboard/dev',
			icon: BrickWallShield,
			roles: ['superadmin']
		},
		{
			split: true,
			roles: ['all']
		},
		{
			label: 'Mes clés API',
			href: '/dashboard/api-keys',
			icon: KeyRound,
			roles: ['all']
		},
		{
			label: 'Profil',
			href: '/dashboard/profile',
			icon: UserPen,
			roles: ['all']
		},
		{
			label: 'Paramètres',
			href: '/dashboard/settings',
			icon: Settings2,
			roles: ['all']
		},
		{
			label: 'Déconnexion',
			href: '/dashboard/logout',
			icon: LogOut,
			roles: ['all']
		}
	];
</script>

<input id="my-drawer-4" type="checkbox" class="drawer-toggle" bind:checked={isDrawerOpen} />

<aside class="drawer-side is-drawer-close:overflow-visible">
	<label for="my-drawer-4" aria-label="close sidebar" class="drawer-overlay"></label>
	<div
		class="flex min-h-full flex-col items-start bg-base-100 max-sm:w-64 is-drawer-close:w-14 is-drawer-open:w-64"
	>
		<!-- Sidebar content here -->
		<ul class="menu w-full grow">
			{#each nav as item, index ('split' in item ? `split-${index}` : item.href || item.label || `item-${index}`)}
				{#if $user && checkRole(item.roles)}
					{#if 'split' in item}
						<div class="divider"></div>
					{:else}
						{@const IconComponent = item.icon}

						<li>
							<a
								class="font-semibold is-drawer-close:tooltip is-drawer-close:tooltip-right"
								class:text-red-400={item.href === '/dashboard/logout'}
								data-tip="Homepage"
								href={item.href}
								onclick={closeDrawerOnMobile}
							>
								<IconComponent size={16} />
								<span class="text-nowrap is-drawer-close:hidden">
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
		</ul>
	</div>
</aside>
