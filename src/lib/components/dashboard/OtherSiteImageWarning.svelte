<script lang="ts">
	interface Props {
		website: string | null | undefined;
		class?: string;
	}

	let { website, class: className = '' }: Props = $props();

	const show = $derived(String(website ?? '').trim() === 'other');
</script>

{#if show}
	<div class={['alert text-sm alert-warning', className].filter(Boolean).join(' ')} role="status">
		<span>
			<strong>Site « Autre » :</strong> n’ajoutez pas d’images illégales (contenu lolicon ou assimilé
			interdit par la loi). Utilisez uniquement une vignette conforme.
		</span>
	</div>
{/if}
