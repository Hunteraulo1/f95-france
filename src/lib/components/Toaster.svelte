<script lang="ts">
	import { toasts } from '$lib/stores';
	import Toast from './Toast.svelte';
</script>

{#each $toasts as toast (toast.id)}
	<Toast {toast} />
{/each}
