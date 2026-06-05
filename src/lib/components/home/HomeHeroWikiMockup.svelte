<script lang="ts">
	import HomeHeroMockupShell from '$lib/components/home/HomeHeroMockupShell.svelte';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import FileText from '@lucide/svelte/icons/file-text';

	const tocItems = [
		{ label: 'Installation', active: true },
		{ label: 'Premiers pas', active: false },
		{ label: 'Traductions VF', active: false },
		{ label: 'FAQ', active: false }
	] as const;

	const sections = [
		{ width: 'w-[88%]', delay: 'before:[animation-delay:-0.3s]' },
		{ width: 'w-[72%]', delay: 'before:[animation-delay:-1.1s]' },
		{ width: 'w-[80%]', delay: 'before:[animation-delay:-2s]' },
		{ width: 'w-[60%]', delay: 'before:[animation-delay:-2.8s]' }
	] as const;

	const lineClass =
		'relative h-[0.7rem] overflow-hidden rounded-sm bg-base-content/16 before:absolute before:inset-y-0 before:left-0 before:w-[35%] before:bg-primary/28 before:opacity-50 before:animate-drift before:content-[""]';
</script>

<HomeHeroMockupShell badge="Wiki F95 France">
	<div
		class="grid h-full min-h-0 grid-cols-[6.5rem_1fr] gap-2 overflow-hidden rounded-lg border border-base-content/12"
	>
		<div class="flex flex-col gap-1.5 bg-base-200/60 p-2">
			<div class="flex items-center gap-1 px-1 text-[0.62rem] font-semibold text-base-content/55">
				<BookOpen class="size-3" aria-hidden="true" />
				Sommaire
			</div>
			{#each tocItems as item (item.label)}
				<div
					class="rounded-md px-1.5 py-1 text-[0.62rem] {item.active
						? 'bg-primary/16 font-semibold text-base-content'
						: 'text-base-content/65'}"
				>
					{item.label}
				</div>
			{/each}
		</div>
		<div class="flex flex-col gap-3 p-2.5">
			<div class="flex items-center gap-2 border-b border-base-content/10 pb-2">
				<FileText class="size-4 text-primary" aria-hidden="true" />
				<div class="h-3 w-32 rounded-sm bg-base-content/22"></div>
			</div>
			{#each sections as section, index (index)}
				<div class="{lineClass} {section.width} {section.delay}"></div>
			{/each}
			<div class="mt-auto grid grid-cols-2 gap-2 pt-1">
				<div class="h-8 rounded-md border border-base-content/12 bg-base-200/50"></div>
				<div class="h-8 rounded-md border border-base-content/12 bg-base-200/50"></div>
			</div>
		</div>
	</div>
</HomeHeroMockupShell>
