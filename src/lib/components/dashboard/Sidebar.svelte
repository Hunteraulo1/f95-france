<script lang="ts">
	import type { User } from '$lib/server/db/schema';
	import { user } from '$lib/stores';
	import { checkRole } from '$lib/utils';
	import { Box, BrickWallShield, Inbox, Languages, LogOut, MonitorCog, Settings, UserPen, type Icon as IconType } from '@lucide/svelte';

  interface Props {
    isSidebarOpen: boolean;
  }
  
  let { isSidebarOpen = $bindable() }: Props = $props();

  interface NavItem {
    label: string;
    href: string;
    icon: typeof IconType;
    split: boolean;
    roles: User['role'][]; // TODO: Add roles to the database
    badge?: number
  }

  const nav: NavItem[] = [
    {
      label: 'Tableau de bord',
      href: '/dashboard/',
      icon: MonitorCog,
      split: false,
      roles: ['all']
    },
    {
      label: 'Profil',
      href: '/dashboard/profile',
      icon: UserPen,
      split: false,
      roles: ['all']
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
      roles: ['admin'],
      badge: 100
    },
    {
      label: 'Paramètres',
      href: '/dashboard/settings',
      icon: UserPen,
      split: false,
      roles: ['all']
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
      roles: ['all']
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
        {#if $user && checkRole(item.roles)}
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
              >
                {item.label}
                {#if item.badge && item.badge > 0}
                  <div class="badge badge-xs badge-primary ml-1">{item.badge > 99 ? '99+' : item.badge}</div>
                {/if}
              </span>
            </a>
          </li>
        {/if}
      {/each}
    </ul>
  </div>
</aside>
