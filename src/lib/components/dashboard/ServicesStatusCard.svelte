<script lang="ts">
	import { enhance } from '$app/forms';
	import { createDevActionEnhance } from '$lib/forms/dev-action';
	import type { ConfigClientSafe } from '$lib/server/app-config';
	import type { DevServiceCheck, DevServicesStatus } from '$lib/server/dev-services-status';
	import type { AllServicesTestReport } from '$lib/server/services-live-test';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Loader from '@lucide/svelte/icons/loader';

	interface Props {
		servicesStatus: DevServicesStatus;
		config?: ConfigClientSafe | null;
		canEditConfig?: boolean;
		enableTestAll?: boolean;
	}

	type ServiceRow = {
		id: string;
		name: string;
		kind: 'integration' | 'security';
		check?: DevServiceCheck;
		configured?: boolean;
		optional?: boolean;
		statusLabel?: string;
		hints?: string[];
		note?: string | null;
		testable: boolean;
	};

	let {
		servicesStatus,
		config = null,
		canEditConfig = false,
		enableTestAll = false
	}: Props = $props();

	let revealInviteCode = $state(false);
	let testAllLoading = $state(false);
	let testAllReport = $state<AllServicesTestReport | null>(null);

	function mapAllServicesTest(data: Record<string, unknown>): AllServicesTestReport {
		const details = data.details;
		if (details && typeof details === 'object' && 'results' in details) {
			return details as AllServicesTestReport;
		}
		return {
			success: false,
			testedAt: new Date().toISOString(),
			results: [
				{
					id: 'error',
					name: 'Tests',
					success: false,
					skipped: false,
					message: typeof data.message === 'string' ? data.message : 'Erreur inconnue',
					detail: typeof details === 'string' ? details : undefined,
					durationMs: 0
				}
			]
		};
	}

	const liveById = $derived(
		testAllReport ? new Map(testAllReport.results.map((r) => [r.id, r])) : null
	);

	const configBadge = (check: DevServiceCheck) => {
		if (check.status === 'ok') return { label: 'Configuré', class: 'badge-success' };
		if (check.status === 'partial') return { label: 'Partiel', class: 'badge-warning' };
		return { label: 'Non configuré', class: 'badge-error' };
	};

	const securityBadge = (row: Pick<ServiceRow, 'configured' | 'statusLabel'>) => {
		if (row.statusLabel) {
			const label = row.statusLabel;
			const className =
				label === 'Activé' || label === 'Configuré' || label === 'Local OK'
					? 'badge-success'
					: label.includes('incomplet') || label === 'Incomplet'
						? 'badge-warning'
						: label === 'Désactivé'
							? 'badge-ghost'
							: row.configured
								? 'badge-success'
								: 'badge-ghost';
			return { label, class: className };
		}
		return row.configured
			? { label: 'Configuré', class: 'badge-success' }
			: { label: 'Non configuré', class: 'badge-ghost' };
	};

	const formatLatency = (id: string, testable: boolean): string => {
		if (!testable) return '—';
		if (testAllLoading) return '…';
		const live = liveById?.get(id);
		if (!live) return '—';
		if (live.skipped) return '—';
		if (!live.success) return live.durationMs > 0 ? `Échec · ${live.durationMs} ms` : 'Échec';
		return `${live.durationMs} ms`;
	};

	const latencyClass = (id: string, testable: boolean): string => {
		if (!testable || testAllLoading) return 'text-base-content/50';
		const live = liveById?.get(id);
		if (!live || live.skipped) return 'text-base-content/50';
		if (!live.success) return 'text-error font-medium';
		return 'text-success font-medium tabular-nums';
	};

	const liveDetail = (id: string): string | undefined => liveById?.get(id)?.detail;

	function securityItemToRow(item: DevServicesStatus['security'][number]): ServiceRow {
		const testable =
			item.id === 'security-txt' ||
			item.id === 'discord-oauth' ||
			item.id === 'discord-webhook-updates' ||
			item.id === 'discord-webhook-translators' ||
			item.id === 'discord-webhook-admin' ||
			item.id === 'turnstile';

		const liveId =
			item.id === 'discord-webhook-updates'
				? 'discord-updates'
				: item.id === 'discord-webhook-translators'
					? 'discord-translators'
					: item.id === 'discord-webhook-admin'
						? 'discord-admin'
						: item.id;

		return {
			id: liveId,
			name: item.label,
			kind: 'security',
			configured: item.configured,
			optional: item.optional,
			statusLabel: item.statusLabel,
			hints: item.hints,
			testable
		};
	}

	const serviceRows = $derived.by((): ServiceRow[] => {
		const rows: ServiceRow[] = [
			{
				id: 'google',
				name: 'Google Sheets',
				kind: 'integration',
				check: servicesStatus.services.google,
				note: servicesStatus.googleSpreadsheetId,
				testable: true
			},
			{
				id: 'mail',
				name: 'Mail (SMTP)',
				kind: 'integration',
				check: servicesStatus.services.mail,
				testable: true
			},
			{
				id: 'libretranslate',
				name: 'LibreTranslate',
				kind: 'integration',
				check: servicesStatus.services.libreTranslate,
				testable: true
			},
			{
				id: 'cron',
				name: 'Cron (CRON_SECRET)',
				kind: 'integration',
				check: servicesStatus.services.cron,
				testable: true
			}
		];

		for (const item of servicesStatus.security) {
			rows.push(securityItemToRow(item));
		}

		return rows;
	});

	const environmentRows = $derived.by((): ServiceRow[] =>
		servicesStatus.environment.map((item) => ({
			id: item.id,
			name: item.label,
			kind: 'security',
			configured: item.configured,
			optional: item.optional,
			statusLabel: item.statusLabel,
			hints: item.hints,
			testable: false
		}))
	);

	const maskedInviteCode = $derived(
		servicesStatus.registration.inviteCode
			? '•'.repeat(Math.min(servicesStatus.registration.inviteCode.length, 16))
			: '—'
	);

	const testedAtLabel = $derived(
		testAllReport ? new Date(testAllReport.testedAt).toLocaleString('fr-FR') : null
	);
</script>

<div class="card w-full border border-base-300 bg-base-100 shadow-xl">
	<div class="card-body gap-6 sm:p-8">
		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h2 class="card-title text-2xl">État des services</h2>
				<p class="text-sm text-base-content/70">
					Configuration et latence des services (après test).
					{#if testedAtLabel}
						Dernier test : {testedAtLabel}.
					{/if}
				</p>
			</div>
			{#if enableTestAll}
				<form
					method="POST"
					action="?/testAllServices"
					use:enhance={createDevActionEnhance<AllServicesTestReport>({
						setLoading: (v) => {
							testAllLoading = v;
						},
						setResult: (v) => {
							testAllReport = v;
						},
						map: mapAllServicesTest
					})}
				>
					<button type="submit" class="btn btn-primary btn-sm" disabled={testAllLoading}>
						{#if testAllLoading}
							<Loader class="size-4 animate-spin" />
							Tests…
						{:else}
							Tout tester
						{/if}
					</button>
				</form>
			{/if}
		</div>

		<div class="divider my-0">Inscription</div>

		<div class="grid gap-4 sm:grid-cols-2">
			<div class="rounded-box border border-base-300 bg-base-200/40 p-4">
				<p class="text-xs font-medium tracking-wide text-base-content/60 uppercase">Statut</p>
				<p class="mt-1">
					{#if servicesStatus.registration.enabled}
						<span class="badge badge-success badge-sm">Activée</span>
					{:else}
						<span class="badge badge-error badge-sm">Désactivée</span>
					{/if}
				</p>
			</div>
			<div class="rounded-box border border-base-300 bg-base-200/40 p-4">
				<p class="text-xs font-medium tracking-wide text-base-content/60 uppercase">
					Code d’inscription
				</p>
				{#if servicesStatus.registration.inviteRequired}
					<div class="mt-2 flex flex-wrap items-center gap-2">
						<code class="rounded bg-base-300 px-2 py-1 text-sm">
							{revealInviteCode ? servicesStatus.registration.inviteCode : maskedInviteCode}
						</code>
						<button
							type="button"
							class="btn btn-ghost btn-xs"
							onclick={() => {
								revealInviteCode = !revealInviteCode;
							}}
						>
							{#if revealInviteCode}
								<EyeOff class="size-3.5" />
								Masquer
							{:else}
								<Eye class="size-3.5" />
								Afficher
							{/if}
						</button>
					</div>
				{:else}
					<p class="mt-1 text-sm text-base-content/70">Aucun code requis</p>
				{/if}
			</div>
		</div>

		<div class="overflow-x-auto">
			<table class="table table-sm">
				<thead>
					<tr>
						<th>Service</th>
						<th class="w-36">Configuration</th>
						<th class="w-32 text-right">Temps de réponse</th>
					</tr>
				</thead>
				<tbody>
					{#each serviceRows as row (row.id)}
						{@render statusRow(row, true)}
					{/each}
				</tbody>
			</table>
		</div>

		{#if environmentRows.length > 0}
			<div class="divider">Variables d’environnement</div>
			<div class="overflow-x-auto">
				<table class="table table-sm">
					<thead>
						<tr>
							<th>Variable</th>
							<th class="w-36">État</th>
						</tr>
					</thead>
					<tbody>
						{#each environmentRows as row (row.id)}
							{@render statusRow(row, false)}
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		{#if config?.canUseGoogleOAuth && canEditConfig}
			<div class="rounded-lg bg-base-200 p-4">
				<p class="mb-2 text-sm font-semibold">OAuth Google</p>
				<p class="mb-2 text-xs text-base-content/70">
					URI de redirection :
					<code class="mt-1 block rounded bg-base-300 px-2 py-1 break-all">
						{typeof window !== 'undefined'
							? `${window.location.origin}/api/google-oauth/callback`
							: 'Chargement…'}
					</code>
				</p>
				<a href="/api/google-oauth/authorize" class="btn btn-outline btn-primary btn-sm">
					{config.hasGoogleOAuthToken ? 'Reconnecter Google OAuth' : 'Autoriser avec Google'}
				</a>
			</div>
		{/if}

		<p class="text-xs text-base-content/50">
			Modifier les variables dans <code>.env</code> ou l’hébergement, puis redéployer. Cliquez sur
			<strong>Tout tester</strong> pour mesurer la latence des services configurés.
		</p>
	</div>
</div>

{#snippet statusRow(row: ServiceRow, showLatency: boolean)}
	{@const badge = row.check != null ? configBadge(row.check) : securityBadge(row)}
	<tr>
		<td>
			<p class="font-medium">{row.name}</p>
			{#if row.note}
				<div class="mt-1 flex flex-wrap items-center gap-1">
					<code class="max-w-full truncate rounded bg-base-200 px-1.5 py-0.5 text-xs">
						{row.note}
					</code>
					{#if row.id === 'google'}
						<a
							href="https://docs.google.com/spreadsheets/d/{row.note}/edit"
							target="_blank"
							rel="noopener noreferrer"
							class="btn btn-ghost btn-xs px-1"
							title="Ouvrir le spreadsheet"
						>
							<ExternalLink class="size-3.5" />
						</a>
					{/if}
				</div>
			{/if}
			{#if row.check && row.check.hints.length > 0}
				<ul class="mt-1 list-inside list-disc text-xs text-base-content/55">
					{#each row.check.hints as hint (hint)}
						<li>{hint}</li>
					{/each}
				</ul>
			{:else if row.hints && row.hints.length > 0}
				<ul class="mt-1 list-inside list-disc text-xs text-base-content/55">
					{#each row.hints as hint (hint)}
						<li>{hint}</li>
					{/each}
				</ul>
			{/if}
			{#if showLatency && liveDetail(row.id)}
				<p class="mt-1 text-xs text-error/90">{liveDetail(row.id)}</p>
			{/if}
			{#if row.optional}
				<span class="text-xs text-base-content/45">(optionnel)</span>
			{/if}
		</td>
		<td>
			<span class="badge badge-sm {badge.class}">{badge.label}</span>
		</td>
		{#if showLatency}
			<td class="text-right text-sm {latencyClass(row.id, row.testable)}">
				{formatLatency(row.id, row.testable)}
			</td>
		{/if}
	</tr>
{/snippet}
