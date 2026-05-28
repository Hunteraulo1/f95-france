<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { user } from '$lib/stores';
	import { profileDashboardHref } from '$lib/utils/profile-url';
	import Menu from '@lucide/svelte/icons/menu';
	import User from '@lucide/svelte/icons/user';
	import banner from '../assets/banner.webp';

	interface Link {
		label: string;
		href: string;
	}

	const links: Link[] = [
		{
			label: 'Accueil',
			href: '/'
		},
		{ label: 'Jeux', href: '/games' },
		{ label: 'Traducteurs', href: '/translators' },
		{ label: 'Mises à jour', href: '/updates' }
	];
</script>

<div class="navbar h-32 px-12 z-10 items-center">
	<a href="/" class="h-full py-10">
		<img src={banner} alt="Bannière de F95 France" class="w-auto h-full object-contain" />
	</a>
	<div class="flex flex-1 justify-end">
		<div
			class="m-2 lg:hidden is-drawer-close:tooltip is-drawer-close:tooltip-right"
			data-tip="Open"
		>
			<label for="my-drawer-4" class="drawer-button btn px-2 btn-ghost is-drawer-open:rotate-y-180">
				<Menu />
			</label>
		</div>
		<ul class="hidden lg:flex flex-wrap items-center gap-4">
			{#each links as link (link.href)}
				<li
					aria-current={page.url.pathname === link.href}
					class="btn text-sm border-0 hover:bg-transparent hover:text-secondary shadow-none font-semibold aria-current:text-primary"
				>
					<a href={link.href}>{link.label}</a>
				</li>
			{/each}
			{#if $user}
				<li class="dropdown dropdown-end">
					<a
						href={$user
							? resolve(profileDashboardHref($user.username))
							: resolve('/dashboard/profile')}
					>
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
				</li>
			{:else}
				<li>
					<a
						aria-current={page.url.pathname === '/dashboard/login'}
						href={resolve('/dashboard/login')}
						class="btn text-sm bg-base-100 border-base-content/10 w-28 shadow-lg font-semibold hover:bg-base-300 hover:text-primary-content p-2 rounded-md aria-current:bg-primary aria-current:text-primary-content"
					>
						Connexion
					</a>
				</li>
				<li>
					<a
						aria-current={page.url.pathname === '/dashboard/register'}
						href={resolve('/dashboard/register')}
						class="btn btn-primary text-sm border-base-content/10 w-28 shadow-lg font-semibold hover:text-primary-content p-2 rounded-md aria-current:bg-primary aria-current:text-primary-content"
					>
						Inscription
					</a>
				</li>
			{/if}
		</ul>
	</div>
</div>
