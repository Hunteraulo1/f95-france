<script lang="ts">
	import OtherSiteImageWarning from '$lib/components/dashboard/OtherSiteImageWarning.svelte';

	let {
		editGameName = $bindable(''),
		editGameDescription = $bindable(''),
		editGameWebsite = $bindable('f95z'),
		editGameThreadId = $bindable(''),
		editGameTags = $bindable(''),
		editGameLink = $bindable(''),
		editGameImage = $bindable(''),
		editGameGameVersion = $bindable(''),
		requireGameImage = false
	}: {
		editGameName?: string;
		editGameDescription?: string;
		editGameWebsite?: string;
		editGameThreadId?: string;
		editGameTags?: string;
		editGameLink?: string;
		editGameImage?: string;
		editGameGameVersion?: string;
		requireGameImage?: boolean;
	} = $props();
</script>

<div class="mt-2 space-y-4">
	<h5 class="text-md font-semibold">Détails du jeu</h5>
	<OtherSiteImageWarning website={editGameWebsite} />
	<div class="grid gap-4 md:grid-cols-2">
		<div class="form-control">
			<label class="label" for="editGameName">
				<span class="label-text">Nom</span>
			</label>
			<input
				id="editGameName"
				name="editGameName"
				class="input-bordered input w-full"
				type="text"
				bind:value={editGameName}
				required
			/>
		</div>
		<div class="form-control">
			<label class="label" for="editGameWebsite">
				<span class="label-text">Site web</span>
			</label>
			<select
				id="editGameWebsite"
				name="editGameWebsite"
				class="select-bordered select w-full"
				bind:value={editGameWebsite}
				required
			>
				<option value="f95z">F95Zone</option>
				<option value="lc">LewdCorner</option>
				<option value="other">Autre</option>
			</select>
		</div>
		<div class="form-control">
			<label class="label" for="editGameThreadId">
				<span class="label-text">Thread ID</span>
			</label>
			<input
				id="editGameThreadId"
				name="editGameThreadId"
				class="input-bordered input w-full"
				type="text"
				placeholder="100"
				bind:value={editGameThreadId}
			/>
		</div>
		<div class="form-control">
			<label class="label" for="editGameGameVersion">
				<span class="label-text">Version jeu</span>
			</label>
			<input
				id="editGameGameVersion"
				name="editGameGameVersion"
				class="input-bordered input w-full"
				type="text"
				bind:value={editGameGameVersion}
			/>
		</div>
		<div class="form-control">
			<label class="label" for="editGameLink">
				<span class="label-text">Lien</span>
			</label>
			<div class="join join-horizontal w-full">
				<input
					id="editGameLink"
					name="editGameLink"
					class="input-bordered input join-item min-w-0 flex-1"
					type="url"
					placeholder="https://..."
					bind:value={editGameLink}
				/>
				<button
					type="button"
					class="btn join-item shrink-0 btn-outline"
					disabled={!editGameLink?.trim()}
					aria-label="Ouvrir le lien dans un nouvel onglet"
					onclick={() => {
						const u = editGameLink?.trim();
						if (u) window.open(u, '_blank', 'noopener,noreferrer');
					}}
				>
					Ouvrir
				</button>
			</div>
		</div>
		<div class="form-control md:col-span-2">
			<label class="label" for="editGameImage">
				<span class="label-text">
					Image{requireGameImage ? '' : ' (optionnel)'}
				</span>
			</label>
			<input
				id="editGameImage"
				name="editGameImage"
				class="input-bordered input w-full"
				type="url"
				placeholder={requireGameImage ? 'https://...' : 'Laisser vide si aucune vignette'}
				bind:value={editGameImage}
				required={requireGameImage}
			/>
		</div>
		<div class="form-control md:col-span-2">
			<label class="label" for="editGameTags">
				<span class="label-text">Tags</span>
			</label>
			<textarea
				id="editGameTags"
				name="editGameTags"
				class="textarea-bordered textarea w-full"
				rows="3"
				bind:value={editGameTags}
			></textarea>
		</div>
		<div class="form-control md:col-span-2">
			<label class="label" for="editGameDescription">
				<span class="label-text">Description</span>
			</label>
			<textarea
				id="editGameDescription"
				name="editGameDescription"
				class="textarea-bordered textarea w-full"
				rows="3"
				bind:value={editGameDescription}
			></textarea>
		</div>
	</div>
</div>
