<script>
	import { user } from '$lib/stores';
	import Menu from '@lucide/svelte/icons/menu';
	import User from '@lucide/svelte/icons/user';
	import pkg from '../../../../package.json';
	import Notifications from './Notifications.svelte';

	const VERSION = pkg.version;
</script>

<div class="navbar h-4 bg-base-100 shadow-sm">
	<div class="m-2 is-drawer-close:tooltip is-drawer-close:tooltip-right" data-tip="Open">
		<label for="my-drawer-4" class="drawer-button btn px-2 btn-ghost is-drawer-open:rotate-y-180">
			<Menu />
		</label>
	</div>
	<div class="flex-1">
		<a class="btn xs:text-xl text-sm leading-none btn-ghost flex flex-col xs:inline" href="/">F95 France
      <span class="text-xs font-bold xs:bg-slate-700 leading-none xs:text-slate-100 text-slate-500 px-2 rounded-full">v{VERSION}</span>
    </a>
    
	</div>
	<div class="flex gap-2">
		<!-- <button class="btn btn-soft btn-primary">Retour au compte { user.username }</button> TODO: Implement user switcher -->
		{#if $user}
			<Notifications />
		{/if}
		<div class="dropdown dropdown-end">
      <a href="/dashboard/profile/">
			<div tabindex="0" role="button" class="btn avatar btn-circle btn-ghost">
          <div class="flex w-10 items-center justify-center rounded-full">
            {#if $user?.avatar && $user.avatar !== ''}
              <img alt="avatar" src={$user.avatar} />
            {:else}
              <User />
            {/if}
          </div>
        </div>
      </a>
		</div>
	</div>
</div>
