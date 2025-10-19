<script lang="ts">
	import type { User } from '$lib/types/data';
	import { checkRole } from '$lib/utils';
	import { Box, BrickWallShield, Inbox, Languages, LogOut, MonitorCog, Settings, UserPen, type Icon as IconType } from '@lucide/svelte';

  let { isSidebarOpen = $bindable(), user }: { isSidebarOpen: boolean, user: User } = $props();

  interface NavItem {
    label: string;
    href: string;
    icon: typeof IconType;
    split: boolean;
    roles: User['role'][]; // TODO: Add roles to the database
  }

  const nav: NavItem[] = [
    {
      label: 'Tableau de bord',
      href: '/',
      icon: MonitorCog,
      split: false,
      roles: ['admin', 'translator', 'user']
    },
    {
      label: 'Profil',
      href: '/profile',
      icon: UserPen,
      split: false,
      roles: ['admin', 'translator', 'user']
    },
    {
      label: 'Traducteurs',
      href: '/translators',
      icon: Languages,
      split: false,
      roles: ['admin']
    },
    {
      label: 'Mes soumissions',
      href: '/my-submissions',
      icon: Inbox,
      split: false,
      roles: ['translator']
    },
    {
      label: 'Soumissions',
      href: '/submissions',
      icon: Box,
      split: false,
      roles: ['admin']
    },
    {
      label: 'Paramètres',
      href: '/settings',
      icon: UserPen,
      split: false,
      roles: ['admin', 'translator', 'user']
    },
    {
      label: 'Configuration',
      href: '/config',
      icon: Settings,
      split: true,
      roles: ['admin']
    },
    {
      label: 'Panel développeur',
      href: '/developer',
      icon: BrickWallShield,
      split: false,
      roles: ['superadmin']
    },
    {
      label: 'Déconnexion',
      href: '/logout',
      icon: LogOut,
      split: true,
      roles: ['admin', 'translator', 'user']
    }
  ]
</script>

<aside class="bg-white dark:bg-gray-900 shadow-sm w-72 h-screen transition-all duration-300 overflow-hidden border-r-2 z-10 border-gray-200 dark:border-gray-700" class:w-0!={!isSidebarOpen}>
  <nav class="flex flex-col gap-2 p-4 text-nowrap">
    {#each nav as item}
      {#if checkRole(user.role, item.roles)}
        {@const IconComponent = item.icon}
        {#if item.split}
          <div class="h-px w-full bg-gray-200 dark:bg-gray-700 my-2"></div>
        {/if}
        <a
          href={item.href}
          class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-2 w-64"
          class:text-red-400!={item.href === '/logout'}
        >
          <IconComponent size={16} />
            {item.label}
        </a>
      {/if}
    {/each}
  </nav>
</aside>
