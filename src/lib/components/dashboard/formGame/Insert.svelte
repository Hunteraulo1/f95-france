<script lang="ts">
	import { newToast } from '$lib/stores';
	import type { FormGameType } from '$lib/types';
	import { coerceGameEngineType } from '$lib/utils/game-engine-type';
	import { safeParseRequiredHttpUrl } from '$lib/utils/link-validation';
	import type { ChangeEventHandler } from 'svelte/elements';
	import {
		type InferOutput,
		object as vObject,
		optional as vOptional,
		safeParse as vSafeParse,
		string as vString
	} from 'valibot';
	import DaisyDashboardModal from '$lib/components/dashboard/DaisyDashboardModal.svelte';

	/** JSON collé depuis f95list-extractor / LC Extractor (pas un enregistrement formulaire). */
	const ExtractorPayload = vObject({
		name: vString(),
		version: vString(),
		description: vString(),
		status: vString(),
		tags: vString(),
		image: vString(),
		gameType: vOptional(vString())
	});

	interface Props {
		game: FormGameType;
		/** Après remplissage des champs jeu (ex. état scrape LC côté parent). */
		onApplied?: (info: { hasImage: boolean }) => void;
	}

	const { game = $bindable(), onApplied }: Props = $props();

	let insertModal = $state(false);
	let insertObject = $state('');
	let isValid = $state(false);

	const applyExtractorToGame = (raw: InferOutput<typeof ExtractorPayload>): boolean => {
		const name = raw.name?.trim();
		if (name) game.name = name;

		const version = raw.version?.trim();
		if (version) game.gameVersion = version;

		const description = raw.description?.trim();
		if (description) game.description = description;

		const tags = raw.tags?.trim();
		if (tags) game.tags = tags;

		if (raw.gameType?.trim()) {
			game.gameType = coerceGameEngineType(raw.gameType);
		}

		const image = raw.image?.trim();
		if (image) {
			const imageUrl = safeParseRequiredHttpUrl(image);
			if (!imageUrl.success) {
				newToast({
					alertType: 'error',
					message: "URL d'image invalide dans les données de l'extractor"
				});
				return false;
			}
			game.image = image;
		}

		// `status` extractor = statut thread forum, pas le statut traduction du formulaire.
		return true;
	};

	const handleClickInsert = (): void => {
		if (!insertObject.trim()) {
			newToast({
				alertType: 'warning',
				message: 'Veuillez entrer les données de l’extractor'
			});
			return;
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(insertObject);
		} catch {
			newToast({
				alertType: 'error',
				message: 'JSON invalide'
			});
			return;
		}

		const validScrape = vSafeParse(ExtractorPayload, parsed);
		if (!validScrape.success) {
			newToast({
				alertType: 'error',
				message: "Données de l'extractor invalides"
			});
			console.error(JSON.stringify(validScrape.issues, null, 2));
			return;
		}

		if (!applyExtractorToGame(validScrape.output)) return;

		const hasImage = Boolean(validScrape.output.image?.trim());
		onApplied?.({ hasImage });

		insertModal = false;
		insertObject = '';
		isValid = false;

		newToast({
			alertType: 'success',
			message: 'Champs du jeu remplis depuis l’extractor'
		});
	};

	const handleInput: ChangeEventHandler<HTMLTextAreaElement> = (e) => {
		const value = e.currentTarget.value.trim();
		if (value === '') {
			isValid = false;
			return;
		}

		try {
			const parsed = JSON.parse(value);
			const validScrape = vSafeParse(ExtractorPayload, parsed);
			isValid = validScrape.success;
		} catch {
			isValid = false;
		}
	};
</script>

<button
	class="btn btn-circle w-full btn-outline btn-secondary md:w-38"
	type="button"
	onclick={() => {
		insertModal = true;
	}}
>
	Insert Data
</button>

<DaisyDashboardModal
	open={insertModal}
	title="Insérer les données du jeu"
	onClose={() => {
		insertModal = false;
	}}
>
	<p>
		Le script fonctionne avec <a class="btn-link" href="https://www.tampermonkey.net"
			>Tampermonkey</a
		>
	</p>
	<a
		class="btn-link"
		target="_blank"
		href="https://github.com/Hunteraulo1/f95list-extractor/raw/refs/heads/main/dist/toolExtractor.user.js"
		>Installer le script</a
	>

	<p class="py-4">Collez les données JSON de l’extractor (remplit uniquement les champs du jeu).</p>
	<textarea
		placeholder="Données de l'Extractor"
		class="textarea-bordered textarea max-h-32 w-full"
		oninput={handleInput}
		bind:value={insertObject}
	></textarea>
	{#snippet footer()}
		<button type="button" class="btn" onclick={() => (insertModal = false)}>Fermer</button>
		<button type="button" onclick={handleClickInsert} disabled={!isValid} class="btn btn-info">
			Remplir les champs
		</button>
	{/snippet}
</DaisyDashboardModal>
