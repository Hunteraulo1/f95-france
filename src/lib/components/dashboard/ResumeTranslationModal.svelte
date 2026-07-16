<script lang="ts">
	import BellRing from '@lucide/svelte/icons/bell-ring';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Gamepad2 from '@lucide/svelte/icons/gamepad-2';

	interface Props {
		gameName: string;
		translationName: string | null;
		confirming?: boolean;
		onClose: () => void;
		onConfirm: () => void;
	}

	let { gameName, translationName, confirming = false, onClose, onConfirm }: Props = $props();

	const displayTranslation = $derived(translationName?.trim() || 'Traduction sans nom');
</script>

<div
	class="modal-open modal"
	role="dialog"
	aria-modal="true"
	aria-labelledby="resume-translation-title"
>
	<div class="modal-box max-w-lg p-0">
		<div class="border-b border-base-300 px-6 py-5">
			<div class="flex items-start gap-3">
				<div class="rounded-box bg-primary/10 p-2 text-primary">
					<BellRing size={20} />
				</div>
				<div class="min-w-0 flex-1">
					<h3 id="resume-translation-title" class="text-lg font-bold text-base-content">
						Reprendre la traduction
					</h3>
					<p class="mt-1 text-sm text-base-content/70">
						Vous suivrez à nouveau les mises à jour de
						<span class="font-medium text-base-content">« {displayTranslation} »</span>
						sur
						<span class="font-medium text-base-content">{gameName}</span>.
					</p>
				</div>
			</div>
		</div>

		<div class="space-y-4 px-6 py-5">
			<div class="space-y-3 rounded-box border border-base-300 bg-base-200/40 p-4">
				<div class="flex items-center gap-2 text-sm font-medium text-base-content">
					<Gamepad2 size={16} class="shrink-0 opacity-70" />
					{gameName}
				</div>
				<ul class="list-inside list-disc space-y-1.5 text-sm text-base-content/80">
					<li>Notifications Discord réactivées pour cette ligne</li>
					<li>Compteur « pas à jour » de nouveau pris en compte</li>
					<li>La ligne remonte dans la liste selon son état de mise à jour</li>
				</ul>
			</div>

			<div role="alert" class="alert alert-soft alert-info">
				<CircleAlert size={18} class="shrink-0" />
				<div class="text-sm">
					<p class="font-medium">Le statut public reste inchangé</p>
					<p class="text-base-content/80">
						Seul <strong>votre suivi personnel</strong> est réactivé ; la fiche jeu n’est pas modifiée.
					</p>
				</div>
			</div>
		</div>

		<div
			class="flex justify-end gap-2 border-t border-base-300 bg-base-100/95 px-6 py-4 backdrop-blur"
		>
			<button type="button" class="btn btn-ghost" disabled={confirming} onclick={onClose}>
				Annuler
			</button>
			<button type="button" class="btn gap-2 btn-primary" disabled={confirming} onclick={onConfirm}>
				{#if confirming}
					<span class="loading loading-sm loading-spinner"></span>
					Reprise en cours…
				{:else}
					<BellRing size={16} />
					Reprendre la traduction
				{/if}
			</button>
		</div>
	</div>
	<button
		type="button"
		class="modal-backdrop"
		aria-label="Fermer"
		disabled={confirming}
		onclick={onClose}
	></button>
</div>
