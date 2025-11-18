<script lang="ts">
	import { user } from '$lib/stores';
	import { formatDate, getStatusBadge, getTypeBadge, getTypeLabel } from '$lib/utils/submissions';
	import { Eye, User } from '@lucide/svelte';

	interface Submission {
		id: string;
		status: string;
		type: string;
		translationId?: string | null;
		adminNotes?: string | null;
		createdAt: Date | string;
		game?: {
			id: string;
			name: string;
			image: string;
		} | null;
		gameId?: string | null;
		translation?: {
			id: string;
			version: string;
			tversion?: string | null;
			translationName?: string | null;
		} | null;
		parsedData?: {
			game?: {
				name: string;
				image?: string | null;
			};
			translation?: {
				version: string;
				tversion?: string | null;
				translationName?: string | null;
			};
		} | null;
		user?: {
			id: string;
			username: string;
			avatar: string;
		} | null;
	}

	interface Props {
		submission: Submission;
		onClick: () => void;
	}

	let { submission, onClick }: Props = $props();
</script>

<div class="card bg-base-100 shadow-sm">
	<div class="card-body">
		<div class="flex items-start justify-between gap-4">
			<div class="flex-1">
				<div class="mb-2 flex items-center gap-3">
					{#if submission.user}
						<div class="mb-2 flex items-center justify-center gap-2">
							<div class="avatar">
								<div class="mask flex h-8 w-8 items-center justify-center mask-squircle">
									{#if submission.user.avatar}
										<img
											src={submission.user.avatar}
											alt={submission.user.username}
											class="h-8 w-8 rounded-full object-cover"
										/>
									{:else}
										<User size={24} />
									{/if}
								</div>
							</div>
							<span class="text-sm opacity-70">{submission.user.username}</span>
						</div>
					{/if}
					<div class="mb-2 flex items-center gap-3">
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
							<div class="badge badge-outline badge-sm">
								ID: {submission.id}
							</div>
						{/if}
					</div>
				</div>

				<div class="mt-2 flex items-center gap-2">
					{#if submission.game}
						{#if submission.game.image}
							<img
								src={submission.game.image}
								alt={submission.game.name}
								class="h-10 w-10 rounded object-cover"
							/>
						{/if}
						<div class="flex flex-col">
							<span class="text-sm font-medium">{submission.game.name}</span>
							{#if submission.translation}
								{@const translation = submission.translation}
								<span class="text-xs opacity-70">
									Traduction: {translation.version}
									{#if translation.tversion}
										- {translation.tversion}
									{/if}
									{#if translation.translationName}
										({translation.translationName})
									{/if}
								</span>
							{:else if submission.parsedData?.translation}
								{@const translation = submission.parsedData.translation}
								<span class="text-xs opacity-70">
									Traduction: {translation.version}
									{#if translation.tversion}
										- {translation.tversion}
									{/if}
									{#if translation.translationName}
										({translation.translationName})
									{/if}
								</span>
							{/if}
						</div>
					{:else if submission.gameId}
						<span class="text-sm opacity-70">Jeu ID: {submission.gameId}</span>
					{:else if submission.parsedData?.game}
						<div class="flex flex-col">
							<span class="text-sm font-medium">{submission.parsedData.game.name}</span>
							{#if submission.parsedData?.translation}
								{@const translation = submission.parsedData.translation}
								<span class="text-xs opacity-70">
									Traduction: {translation.version}
									{#if translation.tversion}
										- {translation.tversion}
									{/if}
									{#if translation.translationName}
										({translation.translationName})
									{/if}
								</span>
							{/if}
						</div>
					{/if}
				</div>

				{#if submission.adminNotes}
					<div class="mt-2 alert alert-info">
						<span class="text-sm">
							<strong>Notes admin:</strong>
							{submission.adminNotes}
						</span>
					</div>
				{/if}

				<div class="mt-2 text-xs opacity-50">
					Créée le {formatDate(submission.createdAt)}
				</div>
			</div>
			<div class="flex gap-2">
				<button class="btn btn-sm btn-primary" onclick={onClick}>
					<Eye size={14} />
					Voir les détails
				</button>
			</div>
		</div>
	</div>
</div>
