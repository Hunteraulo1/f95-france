<script lang="ts">
	import type { ProfileTranslationItem } from '$lib/server/profile-translations';
	import ExternalLink from '@lucide/svelte/icons/external-link';

	interface Props {
		translations: ProfileTranslationItem[];
		totalCount: number;
		translatorName?: string | null;
		allTranslationsHref?: string | null;
	}

	let {
		translations,
		totalCount,
		translatorName = null,
		allTranslationsHref = null
	}: Props = $props();

	const labelStatus = (s: string) => {
		if (s === 'completed') return 'Terminé';
		if (s === 'abandoned') return 'Abandonné';
		return 'En cours';
	};

	const statusBadge = (s: string) => {
		if (s === 'completed') return 'badge-success';
		if (s === 'abandoned') return 'badge-error';
		return 'badge-warning';
	};

	const tnameLabels: Record<string, string> = {
		no_translation: 'Pas de traduction',
		integrated: 'Intégrée',
		translation: 'Traduction',
		translation_with_mods: 'Traduction (avec mods)'
	};

	const labelTname = (s: string) => tnameLabels[s] ?? s;
</script>

<div class="card border border-base-300 bg-base-100/95 shadow-sm">
	<div class="card-body gap-4">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<div>
				<h4 class="card-title text-base">Traductions associées</h4>
				{#if translatorName}
					<p class="text-sm text-base-content/70">Fiche traducteur : {translatorName}</p>
				{/if}
			</div>
			{#if allTranslationsHref && totalCount > translations.length}
				<a href={allTranslationsHref} class="btn btn-ghost btn-sm">Voir tout ({totalCount})</a>
			{/if}
		</div>

		{#if translations.length === 0}
			<p class="text-sm text-base-content/70">
				Aucune traduction liée à ce compte (traducteur ou relecteur).
			</p>
		{:else}
			<div class="overflow-x-auto rounded-box border border-base-300">
				<table class="table table-sm">
					<thead>
						<tr>
							<th>Jeu</th>
							<th>Traduction</th>
							<th>Statut</th>
							<th>Version</th>
							<th>Rôle</th>
							<th class="text-right">Lien</th>
						</tr>
					</thead>
					<tbody>
						{#each translations as t (t.id)}
							<tr>
								<td class="font-medium">
									<a class="link link-hover" href="/dashboard/game/{t.game.id}">{t.game.name}</a>
								</td>
								<td>
									<div class="flex flex-col">
										<span>{t.translationName || '—'}</span>
										<span class="text-xs text-base-content/60">{labelTname(t.tname)}</span>
									</div>
								</td>
								<td>
									<span class={`badge badge-sm ${statusBadge(t.status)}`}
										>{labelStatus(t.status)}</span
									>
								</td>
								<td class="text-xs whitespace-nowrap">
									{#if t.isOutdated}
										<span class="badge badge-sm badge-warning">Pas à jour</span>
									{:else}
										<span class="badge badge-sm badge-success">À jour</span>
									{/if}
								</td>
								<td class="text-xs whitespace-nowrap">
									{t.profileRole === 'translator' ? 'Traducteur' : 'Relecteur'}
								</td>
								<td class="text-right">
									{#if t.tlink?.trim()}
										<a
											class="btn btn-ghost btn-xs btn-square"
											href={t.tlink}
											target="_blank"
											rel="noopener noreferrer"
											aria-label="Ouvrir le lien de traduction"
										>
											<ExternalLink class="h-4 w-4" />
										</a>
									{:else}
										<span class="text-base-content/50">—</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			{#if totalCount > translations.length}
				<p class="text-xs text-base-content/60">
					Aperçu des {translations.length} traductions les plus récentes sur {totalCount} au total.
				</p>
			{/if}
		{/if}
	</div>
</div>
