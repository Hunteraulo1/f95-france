<script lang="ts">
	import { user } from '$lib/stores';
	import { Menu, User } from '@lucide/svelte';
	import Notifications from './Notifications.svelte';

	let { isSidebarOpen = $bindable() }: { isSidebarOpen: boolean } = $props();
</script>

<div class="navbar h-4 bg-base-100 shadow-sm">
	<div class="m-2 is-drawer-close:tooltip is-drawer-close:tooltip-right" data-tip="Open">
		<label for="my-drawer-4" class="drawer-button btn px-2 btn-ghost is-drawer-open:rotate-y-180">
			<Menu />
		</label>
	</div>
	<div class="flex-1">
		<a class="btn text-xl btn-ghost" href="/">F95 France</a>
	</div>
	<div class="flex gap-2">
		<!-- <button class="btn btn-soft btn-primary">Retour au compte { user.username }</button> TODO: Implement user switcher -->
		{#if $user}
			<Notifications />
		{/if}
		<div class="dropdown dropdown-end">
			<div tabindex="0" role="button" class="btn avatar btn-circle btn-ghost">
				<div class="flex w-10 items-center justify-center rounded-full">
					{#if $user?.avatar && $user.avatar !== ''}
						{console.log($user.avatar)}
						<img alt="avatar" src={$user.avatar} />
					{:else}
						<User />
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>
