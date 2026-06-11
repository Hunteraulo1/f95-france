<script lang="ts">
	const MINOR_EXIT_URL = 'https://www.google.com';

	interface Props {
		onConfirm: () => void;
	}

	let { onConfirm }: Props = $props();

	const denyAccess = () => {
		window.location.href = MINOR_EXIT_URL;
	};
</script>

<!-- modal-open requis : sans lui, .modal-box reste à opacity 0 (daisyUI) -->
<dialog
	class="age-verification-modal modal modal-open bg-transparent!"
	open
	aria-labelledby="age-verification-title"
>
	<div
		class="modal-box relative z-10 w-full max-w-lg border border-base-300/80 bg-base-100 shadow-2xl"
	>
		<h2 id="age-verification-title" class="text-xl font-bold">Confirmation d'âge</h2>
		<p class="mt-3 text-base-content/80">
			Ce site traite de contenus pour adultes (jeux +18). En continuant, vous confirmez avoir au
			moins
			<strong>18 ans</strong> et être légalement autorisé à consulter ce type de contenu dans votre pays.
		</p>
		<div class="modal-action mt-6 flex-col gap-2 sm:flex-row sm:justify-end">
			<button type="button" class="btn btn-ghost w-full sm:w-auto" onclick={denyAccess}>
				Non, je suis mineur
			</button>
			<button type="button" class="btn btn-primary w-full sm:w-auto" onclick={onConfirm}>
				Oui, j'ai 18 ans ou plus
			</button>
		</div>
	</div>

	<div
		class="modal-backdrop bg-base-200/25 backdrop-blur-sm backdrop-saturate-150"
		aria-hidden="true"
	></div>
</dialog>
