<script lang="ts">
	import { user } from '$lib/stores';
	import { checkRole, type checkRoleType } from '$lib/utils';
	import { Box, BrickWallShield, Inbox, Languages, Library, LogOut, MonitorCog, Settings, Settings2, UserPen, type Icon as IconType } from '@lucide/svelte';

  interface Props {
    isSidebarOpen: boolean;
  }
  
  let { isSidebarOpen = $bindable() }: Props = $props();

  interface NavItem {
    label: string;
    href: string;
    icon: typeof IconType;
    roles: checkRoleType[];
    badge?: number
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
      roles: ['admin']
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
      badge: 100
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
          {#if 'split' in item}
            <div class="divider"></div>
          {:else}
            {@const IconComponent = item.icon}

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
        {/if}
      {/each}
    </ul>
  </div>
</aside>
