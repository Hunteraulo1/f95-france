<script lang="ts">
	import { appLogLevelsToParam, type AppLogLevel } from '$lib/logs/app-log';

	type Mode = 'http' | 'app';

	let {
		mode,
		activeLevels = [],
		preserve = {}
	}: {
		mode: Mode;
		activeLevels?: AppLogLevel[];
		preserve?: {
			search?: string;
			source?: string;
			limit?: number;
			page?: number;
		};
	} = $props();

	const appHref = () => {
		const pairs: Array<[string, string]> = [];
		if (preserve.search?.trim()) pairs.push(['q', preserve.search.trim()]);
		if (preserve.source?.trim()) pairs.push(['source', preserve.source.trim()]);
		if (preserve.limit) pairs.push(['limit', String(preserve.limit)]);
		if (preserve.page && preserve.page > 1) pairs.push(['page', String(preserve.page)]);
		if (activeLevels.length > 0) {
			pairs.push(['levels', appLogLevelsToParam(activeLevels)]);
		}
		return pairs.length
			? `/dashboard/logs-app?${pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}`
			: '/dashboard/logs-app';
	};

	const httpHref = () => {
		const pairs: Array<[string, string]> = [];
		if (preserve.search?.trim()) pairs.push(['q', preserve.search.trim()]);
		if (preserve.limit) pairs.push(['limit', String(preserve.limit)]);
		if (preserve.page && preserve.page > 1) pairs.push(['page', String(preserve.page)]);
		return pairs.length ? `/dashboard/logs?${pairs.join('&')}` : '/dashboard/logs';
	};
</script>

<div role="tablist" class="tabs-box tabs w-fit max-w-full">
	<a href={httpHref()} class="tab" class:tab-active={mode === 'http'}>Requêtes HTTP</a>
	<a href={appHref()} class="tab" class:tab-active={mode === 'app'}>Application</a>
</div>
