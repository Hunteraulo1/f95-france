<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { SubmissionModalItem } from '$lib/components/dashboard/submissions/submission-modal-types';
	import { newToast, roleBadgeStyles, user } from '$lib/stores';
	import { roleUsernameClass } from '$lib/utils/role-display';
	import { getStatusBadge, getTypeBadge, getTypeLabel } from '$lib/utils/submissions';

	let { submission }: { submission: SubmissionModalItem } = $props();
</script>

<div class="mb-4 flex items-center justify-between border-b border-base-300 pb-4">
	<div class="flex-1">
		<h3 class="text-lg font-bold">
			{#if submission.type === 'update'}
				Changements proposés (jeu)
			{:else if submission.type === 'translator_pages'}
				Changements proposés (pages traducteur)
			{:else if submission.type === 'translation'}
				{#if submission.currentTranslation}
					Changements proposés (traduction)
				{:else}
					Détails de la nouvelle traduction
				{/if}
			{:else if submission.type === 'delete'}
				{#if submission.translationId}
					Demande de suppression (traduction)
				{:else}
					Demande de suppression (jeu)
				{/if}
			{:else}
				Détails du nouveau jeu
			{/if}
		</h3>
		{#if submission.user?.username}
			<div class="mt-1 text-sm text-base-content/70">
				Soumission créée par :
				<a
					class="link link-hover {roleUsernameClass(
						submission.user.role,
						submission.user.role ? $roleBadgeStyles[submission.user.role] : undefined
					)}"
					href={resolve(`/dashboard/profile/${submission.user.username}`)}
					onclick={async (event) => {
						event.preventDefault();
						await goto(resolve(`/dashboard/profile/${submission.user?.username}`));
					}}
				>
					{submission.user.username}
				</a>
			</div>
		{/if}
		{#if submission.openedByUser?.username}
			<div class="mt-1 text-sm text-base-content/70">
				Ouverte par :
				<a
					class="link link-hover {roleUsernameClass(
						submission.openedByUser.role,
						submission.openedByUser.role
							? $roleBadgeStyles[submission.openedByUser.role]
							: undefined
					)}"
					href={resolve(`/dashboard/profile/${submission.openedByUser.username}`)}
					onclick={async (event) => {
						event.preventDefault();
						await goto(resolve(`/dashboard/profile/${submission.openedByUser?.username}`));
					}}
				>
					{submission.openedByUser.username}
				</a>
			</div>
		{/if}
		<div class="mt-2 flex flex-wrap items-center gap-2">
			<div class="badge {getTypeBadge(submission.type, submission.translationId)}">
				{getTypeLabel(submission.type)}
			</div>
			{#if submission.status}
				{@const statusBadge = getStatusBadge(submission.status)}
				{@const StatusIcon = statusBadge.icon}
				<div class="badge {statusBadge.class} gap-1">
					<StatusIcon size={14} />
					{statusBadge.label}
				</div>
			{/if}
			{#if $user?.role === 'superadmin'}
				<button
					type="button"
					class="badge max-w-52 overflow-hidden badge-outline badge-sm text-nowrap hover:bg-base-200 sm:max-w-none"
					onclick={() => {
						navigator.clipboard.writeText(submission.id);
						newToast({
							alertType: 'success',
							message: 'ID de la soumission copié dans le presse-papiers'
						});
					}}
				>
					ID SOUMISSION: {submission.id}
				</button>
				{#if submission.gameId}
					<button
						type="button"
						class="badge max-w-52 overflow-hidden badge-outline badge-sm text-nowrap hover:bg-base-200 sm:max-w-none"
						onclick={() => {
							navigator.clipboard.writeText(submission.gameId!);
							newToast({
								alertType: 'success',
								message: 'ID du jeu copié dans le presse-papiers'
							});
						}}
					>
						ID JEU: {submission.gameId}
					</button>
				{/if}
				{#if submission.translationId}
					<button
						type="button"
						class="badge max-w-52 overflow-hidden badge-outline badge-sm hover:bg-base-200 sm:max-w-none"
						onclick={() => {
							navigator.clipboard.writeText(submission.translationId!);
							newToast({
								alertType: 'success',
								message: 'ID de la traduction copié dans le presse-papiers'
							});
						}}
					>
						ID TRADUCTION: {submission.translationId}
					</button>
				{/if}
			{/if}
		</div>
	</div>
</div>
