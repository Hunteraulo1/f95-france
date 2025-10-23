<script lang="ts">
import { toasts } from '$lib/stores';

interface Props {
  toast: {
    id: string;
    alertType: 'info' | 'warning' | 'success' | 'error';
    message: string;
  };
}

const { toast }: Props = $props();

const removeToast = () => {
  $toasts = $toasts.filter(t => t.id !== toast.id);
};
</script>

{#if toast.alertType == "info"}
  <div class="alert alert-info">
    <span>{toast.message}</span>
    <button class="btn btn-sm btn-circle btn-ghost" onclick={removeToast}>✕</button>
  </div>
{:else if toast.alertType == "warning"}
  <div class="alert alert-warning">
    <span>{toast.message}</span>
    <button class="btn btn-sm btn-circle btn-ghost" onclick={removeToast}>✕</button>
  </div>
{:else if toast.alertType == "success"}
  <div class="alert alert-success">
    <span>{toast.message}</span>
    <button class="btn btn-sm btn-circle btn-ghost" onclick={removeToast}>✕</button>
  </div>
{:else if toast.alertType == "error"}
  <div class="alert alert-error">
    <span>{toast.message}</span>
    <button class="btn btn-sm btn-circle btn-ghost" onclick={removeToast}>✕</button>
  </div>
{/if}
