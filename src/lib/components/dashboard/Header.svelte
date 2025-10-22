<script lang="ts">
	import { user } from '$lib/stores';
	import { Menu } from '@lucide/svelte';

  let { isSidebarOpen = $bindable() }: { isSidebarOpen: boolean } = $props();
</script>

<div class="navbar bg-base-100 shadow-sm h-4">
  <div class="m-2 is-drawer-close:tooltip is-drawer-close:tooltip-right" data-tip="Open">
    <label for="my-drawer-4" class="btn btn-ghost px-2 drawer-button is-drawer-open:rotate-y-180">
      <Menu />
    </label>
  </div>
  <div class="flex-1">
    <a class="btn btn-ghost text-xl" href="/">F95 France</a>
  </div>
  <div class="flex gap-2">
    <!-- <button class="btn btn-soft btn-primary">Retour au compte { $user.username }</button> TODO: Implement user switcher -->
    <div class="dropdown dropdown-end">
      <div tabindex="0" role="button" class="btn btn-ghost btn-circle avatar">
        <div class="w-10 rounded-full">
          {#if $user?.avatar && $user.avatar !== ''}
            <img alt="avatar" src={$user.avatar} />
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>
