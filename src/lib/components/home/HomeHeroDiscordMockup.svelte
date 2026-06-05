<script lang="ts">
	import HomeHeroMockupShell from '$lib/components/home/HomeHeroMockupShell.svelte';
	import Hash from '@lucide/svelte/icons/hash';
	import Volume2 from '@lucide/svelte/icons/volume-2';

	const channels = [
		{ name: 'annonces', active: false, icon: Volume2 },
		{ name: 'général', active: true, icon: Hash },
		{ name: 'traductions', active: false, icon: Hash },
		{ name: 'entraide', active: false, icon: Hash }
	] as const;

	const messages = [
		{ author: 'Modo', color: 'bg-primary/35', width: 'w-[78%]' },
		{ author: 'Traducteur', color: 'bg-secondary/30', width: 'w-[64%]' },
		{ author: 'Joueur', color: 'bg-accent/25', width: 'w-[72%]' },
		{ author: 'Relecteur', color: 'bg-info/25', width: 'w-[58%]' }
	] as const;

	const lineClass =
		'h-[0.65rem] rounded-sm bg-base-content/14 before:absolute before:inset-y-0 before:left-0 before:w-[30%] before:bg-primary/22 before:opacity-60 before:animate-drift before:content-[""] relative overflow-hidden';
</script>

<HomeHeroMockupShell badge="Serveur Discord">
	<div class="grid h-full min-h-0 grid-cols-[5.5rem_1fr] gap-2 overflow-hidden rounded-lg border border-base-content/12">
		<div class="flex flex-col gap-1 bg-base-200/70 p-2">
			{#each channels as channel (channel.name)}
				<div
					class="flex items-center gap-1 rounded-md px-1.5 py-1 text-[0.62rem] font-medium {channel.active
						? 'bg-primary/18 text-base-content'
						: 'text-base-content/70'}"
				>
					<channel.icon class="size-3 shrink-0 opacity-70" aria-hidden="true" />
					<span class="truncate">{channel.name}</span>
				</div>
			{/each}
		</div>
		<div class="flex flex-col gap-2.5 p-2.5">
			{#each messages as message, index (index)}
				<div class="flex flex-col gap-1">
					<div class="flex items-center gap-2">
						<div class="size-5 rounded-full {message.color}"></div>
						<div class="h-2 w-16 rounded-sm bg-base-content/20"></div>
					</div>
					<div class="{lineClass} {message.width}"></div>
					<div class="{lineClass} w-[46%] before:[animation-delay:-1.4s]"></div>
				</div>
			{/each}
		</div>
	</div>
</HomeHeroMockupShell>
