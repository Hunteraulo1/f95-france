<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import InfiniteScrollSentinel from '$lib/components/InfiniteScrollSentinel.svelte';
	import { fetchPaginatedJson } from '$lib/infinite-scroll/fetch-paginated-json';
	import type { TranslatorPageLink } from '$lib/profile/custom-profile';
	import type { PublicTranslatorRow } from '$lib/server/public-translators';
	import { resolveDiscordAvatarDisplayUrl } from '$lib/utils/discord-avatar-url';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Search from '@lucide/svelte/icons/search';
	import User from '@lucide/svelte/icons/user';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let searchQuery = $derived(data.q);
	let searchTimer: ReturnType<typeof setTimeout> | null = null;

	let allTranslators = $state<PublicTranslatorRow[]>([]);
	let loadedPage = $state(1);
	let totalPages = $state(1);
	let loadingMore = $state(false);
	let loadMoreError = $state<string | null>(null);

	const listCacheKey = $derived(data.q);

	$effect(() => {
		String(listCacheKey);
		allTranslators = [...(data.translators ?? [])];
		loadedPage = data.page ?? 1;
		totalPages = data.totalPages ?? 1;
		loadMoreError = null;
	});

	const hasMore = $derived(loadedPage < totalPages);

	const buildQuery = (overrides: { q?: string } = {}) => {
		const qVal = overrides.q !== undefined ? overrides.q : data.q;
		const trimmed = qVal.trim();
		return trimmed ? `?q=${encodeURIComponent(trimmed)}` : '';
	};

	const buildHref = (overrides: { q?: string } = {}) =>
		resolve(`/translators${buildQuery(overrides)}` as '/translators');

	const loadMoreTranslators = async () => {
		if (loadingMore || !hasMore) return;
		loadingMore = true;
		loadMoreError = null;
		try {
			const nextPage = loadedPage + 1;
			const base = buildQuery();
			const sep = base ? '&' : '?';
			const url = `${resolve('/translators')}${base}${sep}page=${nextPage}`;
			const result = await fetchPaginatedJson<PublicTranslatorRow>(url, (body) =>
				Array.isArray(body.translators) ? (body.translators as PublicTranslatorRow[]) : []
			);
			allTranslators = [...allTranslators, ...result.items];
			loadedPage = result.page;
			totalPages = result.totalPages;
		} catch {
			loadMoreError = 'Impossible de charger la suite.';
		} finally {
			loadingMore = false;
		}
	};

	const navigateSearch = (value: string) => {
		void goto(buildHref({ q: value }), {
			replaceState: true,
			keepFocus: true,
			noScroll: true,
			invalidateAll: true
		});
	};

	const onSearchInput = (value: string) => {
		searchQuery = value;
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => navigateSearch(value), 300);
	};

	const translatorPagesMenuLabel = (pages: TranslatorPageLink[]) => {
		if (pages.length === 1) return pages[0].label;
		return `Pages (${pages.length})`;
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

	<label class="input-bordered input flex w-full items-center gap-2">
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
	{:else if !allTranslators.length}
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
					<a href={resolve('/translators')} class="btn btn-primary btn-sm">Réinitialiser</a>
				{/if}
			</div>
		</div>
	{:else}
		<ul class="list rounded-box bg-base-100 shadow-md">
			<li class="p-4 pb-2 text-xs tracking-wide uppercase opacity-60">{resultSummary}</li>

			{#each allTranslators as translator (translator.id)}
				<li class="list-row items-center hover:bg-base-200">
					<div class="shrink-0">
						{#if translator.avatar}
							<img
								class="size-8 rounded-full object-cover"
								src={resolveDiscordAvatarDisplayUrl(translator.avatar)}
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

					<div class="list-col-grow min-w-0">
						{#if translator.profileHref}
							<a href={resolve(translator.profileHref)} class="link font-medium link-hover">
								{translator.name}
							</a>
						{:else}
							<div class="font-medium">{translator.name}</div>
						{/if}
						<div class="text-xs font-semibold uppercase opacity-60">{translator.subtitle}</div>

						{#if translator.pages.length > 0}
							<div class="mt-2 sm:hidden">
								{#if translator.pages.length === 1}
									<a
										href={translator.pages[0].url}
										target="_blank"
										rel="noopener noreferrer"
										class="btn w-full truncate btn-outline font-normal btn-sm"
									>
										{translator.pages[0].label}
									</a>
								{:else}
									<div class="dropdown dropdown-end w-full">
										<div
											tabindex="0"
											role="button"
											class="btn w-full justify-between btn-outline font-normal btn-sm"
										>
											<span class="truncate">{translatorPagesMenuLabel(translator.pages)}</span>
											<ChevronDown class="size-4 shrink-0 opacity-60" />
										</div>
										<ul
											tabindex="-1"
											class="dropdown-content menu z-50 mt-1 w-full rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
										>
											{#each translator.pages as page, pageIndex (`${translator.id}-${page.url}`)}
												<li>
													<a
														href={page.url}
														target="_blank"
														rel="noopener noreferrer"
														class="truncate"
													>
														{#if pageIndex === 0}
															<span class="mr-1 badge badge-xs badge-primary">Principal</span>
														{/if}
														{page.label}
													</a>
												</li>
											{/each}
										</ul>
									</div>
								{/if}
							</div>
						{/if}
					</div>

					{#if translator.pages.length > 0}
						<div class="hidden shrink-0 flex-wrap items-center justify-end gap-1 sm:flex">
							{#each translator.pages as page, pageIndex (`${translator.id}-desktop-${page.url}`)}
								<a
									href={page.url}
									target="_blank"
									rel="noopener noreferrer"
									class="btn max-w-40 truncate btn-ghost font-normal btn-sm"
									class:text-primary={pageIndex === 0}
									title={pageIndex === 0 ? `${page.label} (lien principal)` : page.label}
								>
									{page.label}
								</a>
							{/each}
						</div>
					{/if}
				</li>
			{/each}
		</ul>

		<InfiniteScrollSentinel
			hasMore={hasMore && !data.error}
			loading={loadingMore}
			error={loadMoreError}
			onLoadMore={loadMoreTranslators}
		/>
	{/if}
</main>
