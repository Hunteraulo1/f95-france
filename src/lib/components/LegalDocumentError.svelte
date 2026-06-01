<script lang="ts">
	import { resolve } from '$app/paths';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

	interface Props {
		title: string;
		message: string;
	}

	let { title, message }: Props = $props();
</script>

<svelte:head>
	<title>{title} — F95 France</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-16 lg:px-8">
	<a href={resolve('/')} class="btn w-fit gap-2 btn-ghost btn-sm">
		<ArrowLeft size={18} aria-hidden="true" />
		Retour à l'accueil
	</a>

	<div role="alert" class="alert alert-warning">
		<TriangleAlert size={24} aria-hidden="true" />
		<div>
			<h1 class="font-semibold">{title}</h1>
			<p class="text-sm">{message}</p>
		</div>
	</div>
</main>
