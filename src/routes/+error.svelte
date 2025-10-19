<script lang="ts">
  let { error }: { error: Error } = $props();
</script>

<h1>Error</h1>
<p>{error.message ?? 'An unknown error occurred'}</p>
