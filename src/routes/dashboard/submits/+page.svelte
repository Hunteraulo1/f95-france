<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Pagination from '$lib/components/Pagination.svelte';
	import SubmissionCard from '$lib/components/dashboard/submissions/SubmissionCard.svelte';
	import SubmissionFilters from '$lib/components/dashboard/submissions/SubmissionFilters.svelte';
	import SubmissionModal from '$lib/components/dashboard/submissions/SubmissionModal.svelte';
	import { getStatusFilterLabel } from '$lib/utils/submissions';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let selectedSubmission: (typeof data.submissions)[0] | null = $state(null);
	let pendingFilter = $state<string | null>(null);
	let isFilterChanging = $state(false);
	const activeFilter = $derived(pendingFilter ?? data.statusFilter);
	$effect(() => {
		if (pendingFilter && data.statusFilter === pendingFilter) {
			pendingFilter = null;
			isFilterChanging = false;
		}
	});

	const buildQuery = (overrides: { status?: string; page?: number }) => {
		const status = overrides.status ?? data.statusFilter;
		const page = overrides.page ?? data.page;
		const params = [`status=${encodeURIComponent(status)}`];
		if (page > 1) params.push(`page=${page}`);
		return params.length ? `?${params.join('&')}` : '';
	};

	const buildHref = (overrides: { status?: string; page?: number }) =>
		resolve(`/dashboard/submits${buildQuery(overrides)}` as '/dashboard/submits');

	const openSubmissionModal = async (submission: (typeof data.submissions)[0]) => {
		// Passer en "opened" une seule fois (pending) pour bloquer les modifications côté utilisateur.
		if (submission.status === 'pending') {
			try {
				const formData = new FormData();
				formData.append('submissionId', submission.id);
				await fetch('/dashboard/submits?/openSubmission', {
					method: 'POST',
					body: formData,
					credentials: 'include'
				});
				selectedSubmission = { ...submission, status: 'opened' };
				return;
			} catch {
				// En cas d'erreur, on ouvre quand même la modal.
			}
		}
		selectedSubmission = submission;
	};

	const closeSubmissionModal = async () => {
		selectedSubmission = null;
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- href = resolve(pathname) + ?search
		await goto(`${resolve('/dashboard/submits')}${buildQuery({})}`, {
			noScroll: true,
			invalidateAll: true
		});
	};

	const updateFilter = async (status: string) => {
		if (isFilterChanging || status === activeFilter) {
			return;
		}

		isFilterChanging = true;
		pendingFilter = status;
		try {
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- href = resolve(pathname) + ?search
			await goto(`${resolve('/dashboard/submits')}${buildQuery({ status, page: 1 })}`, {
				noScroll: true,
				invalidateAll: true
			});
		} catch {
			pendingFilter = null;
			isFilterChanging = false;
		}
	};
</script>

<section class="flex flex-col gap-4">
	<div class="flex items-center justify-between">
		<h2 class="text-lg font-semibold text-base-content">
			Soumissions
			<span class="text-sm font-normal opacity-70">
				({data.totalCount} soumission{data.totalCount > 1 ? 's' : ''})
			</span>
		</h2>
	</div>

	<!-- Filtres -->
	<SubmissionFilters
		currentFilter={activeFilter}
		pendingCount={data.pendingCount}
		openedCount={data.openedCount ?? 0}
		acceptedCount={data.acceptedCount}
		rejectedCount={data.rejectedCount}
		toFixCount={data.toFixCount ?? 0}
		disabled={isFilterChanging}
		onFilterChange={updateFilter}
	/>

	{#if data.totalCount === 0}
		<div class="card w-full border border-base-300 bg-base-100 shadow-xl">
			<div class="card-body gap-6 sm:p-8">
				<p class="text-center text-lg opacity-70">
					{#if activeFilter === 'all'}
						Aucune soumission pour le moment
					{:else}
						Aucune soumission {getStatusFilterLabel(activeFilter)}
					{/if}
				</p>
			</div>
		</div>
	{:else}
		<div class="grid gap-4">
			{#each data.submissions as submission (submission.id)}
				<SubmissionCard {submission} onClick={() => openSubmissionModal(submission)} />
			{/each}
		</div>

		<Pagination
			currentPage={data.page}
			totalPages={data.totalPages}
			totalCount={data.totalCount}
			hrefForPage={(p) => buildHref({ page: p })}
			countLabel="soumission"
		/>
	{/if}
</section>

<!-- Modal unifiée de soumission -->
<SubmissionModal
	submission={selectedSubmission}
	translators={data.translators}
	canEditStatus={true}
	onClose={closeSubmissionModal}
/>
