<script lang="ts">
	import type { User } from '$lib/types/data';
	import { Box, BrickWallShield, Inbox, Languages, LogOut, MonitorCog, Settings, UserPen, type Icon as IconType } from '@lucide/svelte';

  interface Props {
    isSidebarOpen: boolean;
    user: User;
  }
  
  let { isSidebarOpen = $bindable(), user }: Props = $props();

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
      href: '/dashboard/',
      icon: MonitorCog,
      split: false,
      roles: ['admin', 'translator', 'user']
    },
    {
      label: 'Profil',
      href: '/dashboard/profile',
      icon: UserPen,
      split: false,
      roles: ['admin', 'translator', 'user']
    },
    {
      label: 'Traducteurs',
      href: '/dashboard/translators',
      icon: Languages,
      split: false,
      roles: ['admin']
    },
    {
      label: 'Mes soumissions',
      href: '/dashboard/my-submissions',
      icon: Inbox,
      split: false,
      roles: ['translator']
    },
    {
      label: 'Soumissions',
      href: '/dashboard/submissions',
      icon: Box,
      split: false,
      roles: ['admin']
    },
    {
      label: 'Paramètres',
      href: '/dashboard/settings',
      icon: UserPen,
      split: false,
      roles: ['admin', 'translator', 'user']
    },
    {
      label: 'Configuration',
      href: '/dashboard/config',
      icon: Settings,
      split: true,
      roles: ['admin']
    },
    {
      label: 'Panel développeur',
      href: '/dashboard/developer',
      icon: BrickWallShield,
      split: false,
      roles: ['superadmin']
    },
    {
      label: 'Déconnexion',
      href: '/dashboard/logout',
      icon: LogOut,
      split: true,
      roles: ['admin', 'translator', 'user']
    }
  ]
</script>

<input id="my-drawer-4" type="checkbox" class="drawer-toggle" checked={true} />

<aside class="drawer-side is-drawer-close:overflow-visible">
  <label for="my-drawer-4" aria-label="close sidebar" class="drawer-overlay"></label>
  <div class="is-drawer-close:w-14 is-drawer-open:w-64 bg-base-100 flex flex-col items-start min-h-full">
    <!-- Sidebar content here -->
    <ul class="menu w-full grow">
      
      {#each nav as item}
        {@const IconComponent = item.icon}
        {#if item.split}
          <div class="divider"></div>
        {/if}
        <li>
          <a
            class="is-drawer-close:tooltip is-drawer-close:tooltip-right font-semibold"
            class:text-red-400={item.href === '/dashboard/logout'}
            data-tip="Homepage"
            href={item.href}
          >
            <IconComponent size={16} />
            <span
              class="is-drawer-close:hidden text-nowrap"
            >{item.label}</span>
          </a>
        </li>
      {/each}
    </ul>
  </div>
</aside>
