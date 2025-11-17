<script lang="ts">
	import { user } from '$lib/stores';
	import { checkRole, type checkRoleType } from '$lib/utils';
	import {
		Box,
		BrickWallShield,
		Inbox,
		Languages,
		Library,
		LogOut,
		MonitorCog,
		ScrollText,
		Settings,
		Settings2,
		UserPen,
		type Icon as IconType
	} from '@lucide/svelte';

	interface Props {
		isSidebarOpen: boolean;
		pendingSubmissionsCount?: number;
	}

	let { isSidebarOpen = $bindable(), pendingSubmissionsCount = 0 }: Props = $props();

	interface NavItem {
		label: string;
		href: string;
		icon: typeof IconType;
		roles: checkRoleType[];
		badge?: number;
		badgeKey?: 'translator' | 'admin';
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
			roles: ['translator'],
			badgeKey: 'translator'
		},
		{
			label: 'Soumissions',
			href: '/dashboard/submits',
			icon: Box,
			roles: ['admin'],
			badgeKey: 'admin'
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
			label: 'Configuration',
			href: '/dashboard/config',
			icon: Settings,
			roles: ['admin']
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

<input id="my-drawer-4" type="checkbox" class="drawer-toggle" checked={true} />

<aside class="drawer-side is-drawer-close:overflow-visible">
	<label for="my-drawer-4" aria-label="close sidebar" class="drawer-overlay"></label>
	<div
		class="flex min-h-full flex-col items-start bg-base-100 is-drawer-close:w-14 is-drawer-open:w-64"
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
							>
								<IconComponent size={16} />
								<span class="text-nowrap is-drawer-close:hidden">
									{item.label}
									{#if (item.badgeKey === 'translator' || item.badgeKey === 'admin' ? pendingSubmissionsCount : item.badge || 0) > 0}
										{@const badgeCount =
											item.badgeKey === 'translator' || item.badgeKey === 'admin'
												? pendingSubmissionsCount
												: item.badge || 0}
										<div class="ml-1 badge badge-xs badge-primary">
											{badgeCount > 99 ? '99+' : badgeCount}
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
