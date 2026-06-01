<script lang="ts">
	import { SITE } from '$lib/site';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Users from '@lucide/svelte/icons/users';
</script>

<a
	href={SITE.discordInviteUrl}
	target="_blank"
	rel="noopener noreferrer"
	class="group card card-border bg-base-100 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg h-full"
	draggable="false"
>
	<div
		class="card-body flex h-full flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
	>
		<div class="flex min-w-0 flex-1 items-start gap-4">
			<div
				class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary transition group-hover:bg-primary/25"
				aria-hidden="true"
			>
				<svg class="size-7" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<path
						d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"
					/>
				</svg>
			</div>
			<div class="min-w-0 space-y-1">
				<h2 class="text-lg font-bold sm:text-xl">Rejoignez notre Discord</h2>
				<p class="text-sm text-base-content/70 sm:text-base">
					Échanges avec la communauté, annonces des mises à jour, entraide traduction et suivi des
					sorties en direct.
				</p>
				<p
					class="flex items-center gap-1.5 text-xs font-medium text-base-content/50 transition group-hover:text-primary"
				>
					<Users class="size-3.5 shrink-0" aria-hidden="true" />
					discord.f95france.site
				</p>
			</div>
		</div>
		<span class="btn btn-primary btn-sm sm:btn-md shrink-0 gap-2">
			Rejoindre le serveur
			<ArrowRight class="size-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
		</span>
	</div>
</a>
