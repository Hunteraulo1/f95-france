<script lang="ts">
	import { resolve } from '$app/paths';
	import MarkdownContent from '$lib/components/MarkdownContent.svelte';
	import type { MarkdownBlock } from '$lib/markdown/content';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';

	interface Props {
		title: string;
		description: string;
		blocks: MarkdownBlock[];
		updatedAt: string | null;
		sourceUrl: string;
	}

	let { title, description, blocks, updatedAt, sourceUrl }: Props = $props();

	const updatedLabel = $derived.by(() => {
		if (!updatedAt) return null;
		const date = new Date(updatedAt);
		if (Number.isNaN(date.getTime())) return null;
		return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(date);
	});
</script>

<svelte:head>
	<title>{title} — F95 France</title>
	<meta name="description" content={description} />
</svelte:head>

<main class="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 lg:px-8">
	<header class="flex flex-col gap-4">
		<a href={resolve('/')} class="btn w-fit gap-2 btn-ghost btn-sm">
			<ArrowLeft size={18} aria-hidden="true" />
			Retour à l'accueil
		</a>
		<div class="flex flex-col gap-2">
			<h1 class="text-3xl font-bold tracking-tight">{title}</h1>
			{#if updatedLabel}
				<p class="text-sm text-base-content/60">Dernière mise à jour du fichier : {updatedLabel}</p>
			{/if}
		</div>
	</header>

	<article class="card border border-base-300/80 bg-base-100 shadow-sm">
		<div class="card-body">
			<MarkdownContent document={blocks} />
		</div>
	</article>

	<p class="text-center text-xs text-base-content/50">
		Contenu synchronisé depuis le
		<a class="link link-hover" href={sourceUrl} target="_blank" rel="noopener noreferrer"
			>CDN F95 France</a
		>.
	</p>
</main>
