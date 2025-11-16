<script lang="ts">
	import { enhance } from '$app/forms';
	import type { User } from '$lib/server/db/schema';
	import { loadUserData, user } from '$lib/stores';
	import { checkRole } from '$lib/utils';

	let users = $state<User[]>([]);
	let profileError = $state<string | null>(null);
	let themeError = $state<string | null>(null);
	let directModeError = $state<string | null>(null);

	$effect(() => {
		if ($user && checkRole(['superadmin'])) {
			users = [$user as User]; // TODO: Get users from database
		}
	});

	const themes: Record<'system' | 'light' | 'dark', string> = {
		system: 'Système',
		light: 'Clair',
		dark: 'Sombre'
	};
</script>

<section class="flex flex-col gap-8">
	<div class="flex flex-col gap-4">
		<h2 class="text-lg font-semibold text-base-content">Informations de profil</h2>

		<div class="card w-full items-center justify-between gap-4 bg-base-100 p-8 shadow-sm">
			{#if profileError}
				<div class="mb-4 alert alert-error">
					<span>{profileError}</span>
				</div>
			{/if}

			<form
				method="POST"
				action="?/updateProfile"
				use:enhance={() => {
					profileError = null;
					return async ({ result, update }) => {
						if (result.type === 'success') {
							await update();
							await loadUserData(); // Recharger les données utilisateur
							profileError = null;
						} else if (result.type === 'failure' && result.data) {
							const message =
								typeof result.data === 'object' && 'message' in result.data
									? String(result.data.message)
									: 'Erreur lors de la mise à jour';
							profileError = message;
						}
					};
				}}
			>
				<div class="mb-4 flex w-full items-center justify-between gap-4">
					<span class="opacity-70"
						>Les informations dans cette section sont affichées sur votre page de profil.</span
					>
				</div>
				<div class="flex w-full flex-col items-center justify-between gap-4 md:flex-row">
					<label class="input flex w-full">
						Pseudo
						<input
							type="text"
							name="username"
							class="grow ring-0"
							placeholder="Pseudo"
							value={$user?.username || ''}
							required
						/>
					</label>
					<label class="input flex w-full">
						Photo de profil
						<input
							type="url"
							name="avatar"
							class="grow ring-0"
							placeholder="monlien.com/photo.jpg"
							value={$user?.avatar || ''}
						/>
					</label>
				</div>
				<div class="mt-4 flex justify-end">
					<button type="submit" class="btn btn-primary"> Enregistrer </button>
				</div>
			</form>
		</div>
	</div>

	<div class="flex flex-col gap-4">
		<h2 class="text-lg font-semibold text-base-content">Préférences utilisateur</h2>

		<div class="card w-full items-center justify-between gap-4 bg-base-100 p-8 shadow-sm">
			{#if themeError}
				<div class="mb-4 alert alert-error">
					<span>{themeError}</span>
				</div>
			{/if}

			<form
				method="POST"
				action="?/updateTheme"
				use:enhance={() => {
					themeError = null;
					return async ({ result, update }) => {
						if (result.type === 'success') {
							await update();
							await loadUserData(); // Recharger les données utilisateur
							themeError = null;
						} else if (result.type === 'failure' && result.data) {
							const message =
								typeof result.data === 'object' && 'message' in result.data
									? String(result.data.message)
									: 'Erreur lors de la mise à jour';
							themeError = message;
						}
					};
				}}
			>
				<div class="mb-4 flex w-full items-center justify-between gap-4">
					<span class="opacity-70"
						>Les informations dans cette section sont affichées sur votre page de profil.</span
					>
				</div>
				<div class="flex w-full flex-col items-center justify-between gap-4 md:flex-row">
					<label class="input box-content flex w-full">
						Thème
						<select
							data-choose-theme
							name="theme"
							class="select h-[calc(100%-2px)] grow select-ghost bg-base-100 py-1 text-base-content ring-0 outline-none"
							value={$user?.theme || 'system'}
							required
							onchange={(e) => {
								const selectedTheme = e.currentTarget.value;
								// Si 'system', theme-change utilise une chaîne vide pour détecter les préférences système
								if (selectedTheme === 'system') {
									// Retirer le thème pour que theme-change utilise les préférences système
									document.documentElement.removeAttribute('data-theme');
									localStorage.removeItem('theme');
								}
								// Envoyer la mise à jour au serveur
								const form = e.currentTarget.closest('form');
								if (form) {
									form.requestSubmit();
								}
							}}
						>
							{#each Object.keys(themes) as theme (theme)}
								<option value={theme}>{themes[theme as keyof typeof themes]}</option>
							{/each}
						</select>
					</label>
				</div>
			</form>
		</div>
	</div>

	{#if $user && checkRole(['superadmin'])}
		<div class="flex flex-col gap-4">
			<h2 class="text-lg font-semibold text-base-content">Paramètres développeur</h2>

			<div class="card w-full items-center justify-between gap-4 bg-base-100 p-8 shadow-sm">
				{#if directModeError}
					<div class="mb-4 alert alert-error">
						<span>{directModeError}</span>
					</div>
				{/if}

				<form
					method="POST"
					action="?/updateDirectMode"
					use:enhance={() => {
						directModeError = null;
						return async ({ result, update }) => {
							if (result.type === 'success') {
								await update();
								await loadUserData(); // Recharger les données utilisateur
								directModeError = null;
							} else if (result.type === 'failure' && result.data) {
								const message =
									typeof result.data === 'object' && 'message' in result.data
										? String(result.data.message)
										: 'Erreur lors de la mise à jour';
								directModeError = message;
							}
						};
					}}
				>
					<div class="mb-4 flex w-full items-center justify-between gap-4">
						<span class="opacity-70"
							>Mode direct : quand activé, les modifications sont appliquées directement sans créer
							de soumission. Quand désactivé, les modifications créent des soumissions en attente
							d'approbation.</span
						>
					</div>
					<div class="flex w-full flex-col items-center justify-between gap-4 md:flex-row">
						<label class="label cursor-pointer">
							<span class="label-text">Mode direct</span>
							<input
								type="checkbox"
								name="directMode"
								class="toggle toggle-primary"
								checked={$user?.directMode ?? true}
								onchange={(e) => {
									const form = e.currentTarget.closest('form');
									if (form) {
										// Mettre à jour la valeur du checkbox pour l'envoi
										const hiddenInput = form.querySelector(
											'input[type="hidden"]'
										) as HTMLInputElement;
										if (hiddenInput) {
											hiddenInput.value = e.currentTarget.checked ? 'true' : 'false';
										}
										form.requestSubmit();
									}
								}}
							/>
							<input type="hidden" name="directMode" value={$user?.directMode ? 'true' : 'false'} />
						</label>
					</div>
				</form>
			</div>
		</div>

		<div class="flex flex-col gap-4">
			<h2 class="text-lg font-semibold text-base-content">Changer d'utilisateur (Dev)</h2>

			<div class="card w-full items-center justify-between gap-4 bg-base-100 p-8 shadow-sm">
				<div class="flex w-full items-center justify-between gap-4">
					<span class="opacity-70"
						>Fonctionnalité permettant d'utiliser un autre compte utilisateur.</span
					>
				</div>
				<div class="flex w-full flex-col items-center justify-between gap-4 md:flex-row">
					<label class="input box-content flex w-full">
						Utilisateur
						<select
							class="select h-[calc(100%-2px)] grow select-ghost bg-base-100 py-1 text-base-content ring-0 outline-none"
						>
							{#each users as user (user.id)}
								<option value="user.id">{user.username}</option>
							{/each}
						</select>
					</label>
				</div>
			</div>
		</div>
	{/if}
</section>
