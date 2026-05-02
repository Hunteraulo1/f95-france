<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
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

	const openSubmissionModal = async (submission: (typeof data.submissions)[0]) => {
		// Passer immédiatement la soumission en "opened" pour bloquer les modifications côté user.
		try {
			const formData = new FormData();
			formData.append('submissionId', submission.id);
			await fetch('/dashboard/submits?/openSubmission', {
				method: 'POST',
				body: formData,
				credentials: 'include'
			});
			selectedSubmission = { ...submission, status: 'opened' };
		} catch {
			// En cas d'erreur, on ouvre quand même la modal (le serveur refusera si besoin).
			selectedSubmission = submission;
		}
	};

	const closeSubmissionModal = async () => {
		selectedSubmission = null;
		await goto(resolve(`/dashboard/submits?status=${data.statusFilter}`), {
			noScroll: true,
			invalidateAll: true
		});
	};

	const updateFilter = async (status: string) => {
		await goto(resolve(`/dashboard/submits?status=${status}`), {
			noScroll: true,
			invalidateAll: true
		});
	};
</script>

<section class="flex flex-col gap-4">
	<div class="flex items-center justify-between">
		<h2 class="text-lg font-semibold text-base-content">
			Soumissions
			<span class="text-sm font-normal opacity-70">
				({data.submissions.length} soumission{data.submissions.length > 1 ? 's' : ''})
			</span>
		</h2>
	</div>

	<!-- Filtres -->
	<SubmissionFilters
		currentFilter={data.statusFilter}
		pendingCount={data.pendingCount}
		openedCount={data.openedCount ?? 0}
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
				<SubmissionCard {submission} onClick={() => openSubmissionModal(submission)} />
			{/each}
		</div>
	{/if}
</section>

<!-- Modal unifiée de soumission -->
<SubmissionModal
	submission={selectedSubmission}
	translators={data.translators}
	canEditStatus={true}
	onClose={closeSubmissionModal}
/>
