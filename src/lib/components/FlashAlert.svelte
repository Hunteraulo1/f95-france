<script lang="ts">
	interface Props {
		type: 'success' | 'error' | 'warning' | 'info';
		text: string;
	}

	let { type, text }: Props = $props();

	const alertClass = $derived(
		{
			success: 'alert-success',
			error: 'alert-error',
			warning: 'alert-warning',
			info: 'alert-info'
		}[type]
	);
</script>

<div role="alert" class="alert {alertClass}">
	<span>{text}</span>
</div>
