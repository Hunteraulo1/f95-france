<script lang="ts">
	import { resolve } from '$app/paths';
	import { user } from '$lib/stores';
	import Menu from '@lucide/svelte/icons/menu';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import User from '@lucide/svelte/icons/user';
	import pkg from '../../../../package.json';
	import Notifications from './Notifications.svelte';

	interface Props {
		maintenanceMode?: boolean;
	}

	let { maintenanceMode = false }: Props = $props();

	const VERSION = pkg.version;
</script>

<div class="navbar h-4 bg-base-100 shadow-sm">
	<div class="m-2 is-drawer-close:tooltip is-drawer-close:tooltip-right" data-tip="Open">
		<label for="my-drawer-4" class="drawer-button btn px-2 btn-ghost is-drawer-open:rotate-y-180">
			<Menu />
		</label>
	</div>
	<div class="flex flex-1 flex-wrap items-center gap-2">
		<a class="btn btn-ghost" href="/">
			<div class="flex w-full flex-col items-center justify-center gap-2 xs:flex-row">
				<h1 class="text-sm xs:text-xl">F95 France</h1>
				<span
					class="rounded-full px-2 text-xs font-bold text-slate-500 xs:bg-slate-700 xs:text-slate-100"
				>
					v{VERSION}
				</span>
			</div>
		</a>
		{#if maintenanceMode}
			<span
				class="badge gap-1 p-1 badge-warning xs:p-2"
				title="Le site est temporairement en maintenance"
			>
				<TriangleAlert size={14} />
				<span class="hidden xs:block">Maintenance</span>
			</span>
		{/if}
	</div>
	<div class="flex gap-2">
		{#if $user}
			<Notifications />
		{/if}
		<div class="dropdown dropdown-end">
			<a href={$user ? resolve(`/dashboard/profile/${$user.id}`) : resolve('/dashboard/profile')}>
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
