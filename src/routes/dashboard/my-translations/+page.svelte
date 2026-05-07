<script lang="ts">
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

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

	const staff = (id: string | null) => {
		if (!id) return null;
		return data.staffById?.[id] ?? { name: id, username: null };
	};
</script>

<div class="space-y-6">
	<div class="flex flex-wrap items-end justify-between gap-4">
		<div>
			<h1 class="text-3xl font-bold text-base-content">Mes traductions</h1>
			<p class="mt-1 text-sm text-base-content/70">
				{#if data.linkedTranslator}
					Filtré sur <strong>{data.linkedTranslator.name}</strong> (traducteur ou relecteur).
					{#if data.outdatedCount > 0}
						<span class="ml-2 badge badge-sm badge-warning">
							{data.outdatedCount} non à jour
						</span>
					{/if}
				{:else}
					Aucun traducteur n’est lié à ton compte.
				{/if}
			</p>
		</div>

		{#if data.linkedTranslator}
			<div class="join">
				<a
					class="btn join-item btn-sm {data.statusFilter === 'all' ? 'btn-active' : 'btn-outline'}"
					href="/dashboard/my-translations?status=all">Toutes</a
				>
				<a
					class="btn join-item btn-sm {data.statusFilter === 'in_progress'
						? 'btn-active'
						: 'btn-outline'}"
					href="/dashboard/my-translations?status=in_progress">En cours</a
				>
				<a
					class="btn join-item btn-sm {data.statusFilter === 'completed'
						? 'btn-active'
						: 'btn-outline'}"
					href="/dashboard/my-translations?status=completed">Terminées</a
				>
				<a
					class="btn join-item btn-sm {data.statusFilter === 'abandoned'
						? 'btn-active'
						: 'btn-outline'}"
					href="/dashboard/my-translations?status=abandoned">Abandonnées</a
				>
			</div>
		{/if}
	</div>

	{#if !data.linkedTranslator}
		<div role="alert" class="alert alert-warning">
			<div>
				<div class="font-semibold">Aucun lien traducteur</div>
				<div class="text-sm opacity-80">
					Demande à un admin de lier ton compte à ton entrée « Traducteur/Relecteur ».
				</div>
			</div>
			<a class="btn btn-outline btn-sm" href="/dashboard/settings">Paramètres</a>
		</div>
	{:else if data.translations.length === 0}
		<div class="card bg-base-100 shadow">
			<div class="card-body">
				<h2 class="card-title">Aucune traduction trouvée</h2>
				<p class="text-base-content/70">
					Sur ce filtre, aucune ligne ne correspond à ton rôle (traducteur / relecteur).
				</p>
			</div>
		</div>
	{:else}
		<div class="overflow-x-auto rounded-box border border-base-300 bg-base-100">
			<table class="table">
				<thead>
					<tr>
						<th>Jeu</th>
						<th>Traduction</th>
						<th>Mise à jour</th>
						<th>Statut</th>
						<th>Versions</th>
						<th>Rôle</th>
						<th class="text-right">Lien de traduction</th>
					</tr>
				</thead>
				<tbody>
					{#each data.translations as t (t.id)}
						<tr>
							<td class="font-semibold">
								<a class="link link-hover" href={`/dashboard/game/${t.game.id}`}>{t.game.name}</a>
							</td>
							<td>
								<div class="flex flex-col">
									<span>{t.translationName || '—'}</span>
									<span class="text-xs opacity-70">{t.tname} · {t.ttype}</span>
								</div>
							</td>
							<td>
								{#if t.isOutdated}
									<span class="badge badge-sm text-nowrap badge-warning">Non à jour</span>
								{:else}
									<span class="badge badge-sm text-nowrap badge-success">À jour</span>
								{/if}
							</td>
							<td>
								<span class={`badge badge-sm ${statusBadge(t.status)}`}
									>{labelStatus(t.status)}</span
								>
							</td>
							<td class="text-sm">
								<div class="flex flex-col">
									<span>Ref: {t.version || '—'}</span>
									<span>Trad: {t.tversion || '—'}</span>
									<span class="text-xs opacity-70">Jeu: {t.game.gameVersion || '—'}</span>
								</div>
							</td>
							<td class="text-sm">
								{#if t.translatorId === data.linkedTranslator.id}
									{@const proofreader = staff(t.proofreaderId)}
									<div>Mon rôle : Traducteur</div>
									<div class="text-xs opacity-70">
										Relecteur :
										{#if proofreader?.username}
											<a
												class="link link-hover"
												href={`/dashboard/profile/${proofreader.username}`}
											>
												{proofreader.name}
											</a>
										{:else}
											{proofreader?.name ?? '—'}
										{/if}
									</div>
								{:else}
									{@const translator = staff(t.translatorId)}
									<div>Mon rôle : Relecteur</div>
									<div class="text-xs opacity-70">
										Traducteur :
										{#if translator?.username}
											<a class="link link-hover" href={`/dashboard/profile/${translator.username}`}>
												{translator.name}
											</a>
										{:else}
											{translator?.name ?? '—'}
										{/if}
									</div>
								{/if}
							</td>
							<td class="text-right">
								{#if t.tlink && t.tlink.trim().length > 0}
									<a
										class="btn btn-ghost btn-sm"
										href={t.tlink}
										target="_blank"
										rel="noopener noreferrer"
										aria-label="Ouvrir le lien"
									>
										<ExternalLink size={16} />
									</a>
								{:else}
									<span class="text-sm opacity-60">—</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
