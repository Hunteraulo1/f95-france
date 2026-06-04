<script lang="ts">
	import BellOff from '@lucide/svelte/icons/bell-off';
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
	aria-labelledby="abandon-translation-title"
>
	<div class="modal-box max-w-lg p-0">
		<div class="border-b border-base-300 px-6 py-5">
			<div class="flex items-start gap-3">
				<div class="rounded-box bg-error/10 p-2 text-error">
					<BellOff size={20} />
				</div>
				<div class="min-w-0 flex-1">
					<h3 id="abandon-translation-title" class="text-lg font-bold text-base-content">
						Abandonner la traduction
					</h3>
					<p class="mt-1 text-sm text-base-content/70">
						Vous ne suivrez plus les mises à jour de
						<span class="font-medium text-base-content">« {displayTranslation} »</span>
						sur
						<span class="font-medium text-base-content">{gameName}</span>.
					</p>
				</div>
			</div>
		</div>

		<div class="space-y-4 px-6 py-5">
			<div class="rounded-box space-y-3 border border-base-300 bg-base-200/40 p-4">
				<div class="flex items-center gap-2 text-sm font-medium text-base-content">
					<Gamepad2 size={16} class="shrink-0 opacity-70" />
					{gameName}
				</div>
				<ul class="list-inside list-disc space-y-1.5 text-sm text-base-content/80">
					<li>Plus de notifications Discord pour cette ligne</li>
					<li>Plus de compteur « pas à jour » sur votre tableau de bord</li>
					<li>Vous pourrez toujours consulter la fiche jeu</li>
				</ul>
			</div>

			<div role="alert" class="alert alert-warning alert-soft">
				<CircleAlert size={18} class="shrink-0" />
				<div class="text-sm">
					<p class="font-medium">Le statut public reste inchangé</p>
					<p class="text-base-content/80">
						La traduction sur la fiche jeu conserve son statut (en cours, terminée, etc.). Seul
						<strong>votre suivi personnel</strong> est coupé.
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
			<button type="button" class="btn btn-error gap-2" disabled={confirming} onclick={onConfirm}>
				{#if confirming}
					<span class="loading loading-spinner loading-sm"></span>
					Abandon en cours…
				{:else}
					<BellOff size={16} />
					Abandonner la traduction
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
