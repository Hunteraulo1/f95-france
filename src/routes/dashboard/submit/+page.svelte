<script lang="ts">
	import { goto } from '$app/navigation';
	import SubmissionCard from '$lib/components/dashboard/submissions/SubmissionCard.svelte';
	import SubmissionFilters from '$lib/components/dashboard/submissions/SubmissionFilters.svelte';
	import SubmissionModal from '$lib/components/dashboard/submissions/SubmissionModal.svelte';
	import { getStatusFilterLabel } from '$lib/utils/submissions';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let showSubmissionModal = $state(false);
	let selectedSubmission: (typeof data.submissions)[0] | null = $state(null);

	const openSubmissionModal = (submission: (typeof data.submissions)[0]) => {
		selectedSubmission = submission;
		showSubmissionModal = true;
	};

	const closeSubmissionModal = () => {
		showSubmissionModal = false;
		selectedSubmission = null;
	};

	const updateFilter = async (status: string) => {
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		await goto(`/dashboard/submit?status=${status}`, { noScroll: true, invalidateAll: true });
	};
</script>

<section class="flex flex-col gap-4">
	<div class="flex items-center justify-between">
		<h2 class="text-lg font-semibold text-base-content">
			Mes soumissions
			<span class="text-sm font-normal opacity-70">
				({data.submissions.length} soumission{data.submissions.length > 1 ? 's' : ''})
			</span>
		</h2>
	</div>

	<!-- Filtres -->
	<SubmissionFilters
		currentFilter={data.statusFilter}
		pendingCount={data.pendingCount}
		acceptedCount={data.acceptedCount}
		rejectedCount={data.rejectedCount}
		onFilterChange={updateFilter}
	/>

	{#if data.submissions.length === 0}
		<div class="card bg-base-100 p-8 shadow-sm">
			<div class="text-center">
				<p class="text-lg opacity-70">
					Aucune soumission {getStatusFilterLabel(data.statusFilter) || ''}
				</p>
			</div>
		</div>
	{:else}
		<div class="grid gap-4">
			{#each data.submissions as submission (submission.id)}
				<SubmissionCard submission={submission} onClick={() => openSubmissionModal(submission)} />
			{/each}
		</div>
	{/if}
</section>

<!-- Modal unifiée de soumission -->
<SubmissionModal
	submission={selectedSubmission}
	translators={data.translators}
	canEditStatus={false}
	onClose={closeSubmissionModal}
/>
