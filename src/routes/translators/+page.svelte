<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Search from '@lucide/svelte/icons/search';
	import User from '@lucide/svelte/icons/user';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let searchQuery = $derived(data.q);
	let searchTimer: ReturnType<typeof setTimeout> | null = null;

	const buildHref = (q: string) => {
		const trimmed = q.trim();
		if (!trimmed) return resolve('/translators');
		return resolve(`/translators?q=${encodeURIComponent(trimmed)}`);
	};

	const onSearchInput = (value: string) => {
		searchQuery = value;
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			void goto(buildHref(value), {
				replaceState: true,
				keepFocus: true,
				noScroll: true,
				invalidateAll: true
			});
		}, 300);
	};

	const resultSummary = $derived.by(() => {
		if (data.error) return '';
		const countLabel = `${data.total} traducteur${data.total > 1 ? 's' : ''}`;
		if (data.q.trim()) {
			return `${countLabel} trouvé${data.total > 1 ? 's' : ''}`;
		}
		return countLabel;
	});
</script>

<svelte:head>
	<title>Traducteurs — F95 France</title>
	<meta
		name="description"
		content="Découvrez les traducteurs et relecteurs de la communauté F95 France."
	/>
</svelte:head>

<main class="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 lg:px-8">
	<header class="flex flex-col gap-3">
		<h1 class="text-3xl font-bold">Traducteurs</h1>
		<p class="text-base-content/70">
			Les membres qui traduisent et relisent les jeux référencés sur F95 France.
		</p>
	</header>

	<label class="input input-bordered flex w-full items-center gap-2">
		<Search class="size-4 shrink-0 opacity-60" />
		<input
			type="search"
			class="grow"
			placeholder="Rechercher un traducteur…"
			value={searchQuery}
			oninput={(event) => onSearchInput(event.currentTarget.value)}
		/>
	</label>

	{#if data.error}
		<div role="alert" class="alert alert-warning">
			<span>{data.error}</span>
		</div>
	{:else if !data.translators.length}
		<div class="card border border-base-300 bg-base-100">
			<div class="card-body items-start gap-2">
				<h2 class="card-title text-lg">Aucun traducteur trouvé</h2>
				<p class="text-base-content/70">
					{#if data.q.trim()}
						Essayez un autre terme de recherche ou effacez le filtre.
					{:else}
						La liste sera alimentée lorsque des traducteurs seront ajoutés.
					{/if}
				</p>
				{#if data.q.trim()}
					<a href={resolve('/translators')} class="btn btn-sm btn-primary">Réinitialiser</a>
				{/if}
			</div>
		</div>
	{:else}
		<ul class="list rounded-box bg-base-100 shadow-md">
			<li class="p-4 pb-2 text-xs tracking-wide opacity-60 uppercase">{resultSummary}</li>

			{#each data.translators as translator (translator.id)}
				<li class="list-row hover:bg-base-200">
					<div>
						{#if translator.avatar}
							<img
								class="rounded-full size-8 object-cover"
								src={translator.avatar}
								alt=""
								loading="lazy"
							/>
						{:else}
							<div
								class="flex size-8 items-center justify-center rounded-full bg-base-300 text-base-content/60"
							>
								<User class="size-5" />
							</div>
						{/if}
					</div>

					<div class="min-w-0">
						{#if translator.profileHref}
							<a href={resolve(translator.profileHref)} class="link link-hover font-medium">
								{translator.name}
							</a>
						{:else}
							<div class="font-medium">{translator.name}</div>
						{/if}
						<div class="text-xs font-semibold uppercase opacity-60">{translator.subtitle}</div>
					</div>

					{#each translator.pages as page, index (`${translator.id}-${index}-${page.url}`)}
						<a
							href={page.url}
							target="_blank"
							rel="noopener noreferrer"
							class="btn btn-link p-0"
							aria-label={page.label}
							title={page.label}
						>
							{page.label}
						</a>
					{/each}
				</li>
			{/each}
		</ul>
	{/if}
</main>
