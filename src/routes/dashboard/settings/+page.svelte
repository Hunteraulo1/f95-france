<script lang="ts">
	import { enhance } from '$app/forms';
	import { startRegistration } from '@simplewebauthn/browser';
	import type { User } from '$lib/server/db/schema';
	import { loadUserData, user } from '$lib/stores';
	import { checkRole } from '$lib/utils';
	import { themeChange } from 'theme-change';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	type DevUserLite = Pick<User, 'id' | 'username' | 'role'>;
	let users = $state<DevUserLite[]>([]);
	let profileError = $state<string | null>(null);
	let themeError = $state<string | null>(null);
	let directModeError = $state<string | null>(null);
	let switchUserError = $state<string | null>(null);
	let returnUserError = $state<string | null>(null);
	let passwordError = $state<string | null>(null);
	let passwordInfo = $state<string | null>(null);
	let twoFactorError = $state<string | null>(null);
	let twoFactorInfo = $state<string | null>(null);
	let qrCodeDataUrl = $state<string | null>(null);
	let manualEntryKey = $state<string | null>(null);
	let verificationCode = $state('');
	let disableCode = $state('');
	let disablePassword = $state('');
	let passkeyError = $state<string | null>(null);
	let passkeyInfo = $state<string | null>(null);
	let passkeyBusy = $state(false);
	let selectedTheme = $state($user?.theme || 'system');
	let targetUserId = $state('');

	$effect(() => {
		if ($user && checkRole(['superadmin'])) {
			const nextUsers = (data.devUsers ?? []) as DevUserLite[];
			users = nextUsers;
			targetUserId = nextUsers.some((u) => u.id === $user?.id)
				? ($user?.id ?? '')
				: (nextUsers[0]?.id ?? '');
		}
		if ($user?.theme) {
			// Eviter une réaffectation inutile (réduit le risque de rerenders en boucle).
			if (selectedTheme !== $user.theme) selectedTheme = $user.theme;
		}
	});

	$effect(() => {
		// Nettoyer les données de setup si la 2FA est active
		if ($user?.twoFactorEnabled) {
			qrCodeDataUrl = null;
			manualEntryKey = null;
			verificationCode = '';
		}
	});

	const themes: Record<'system' | 'light' | 'dark', string> = {
		system: 'Système',
		light: 'Clair',
		dark: 'Sombre'
	};

	const applyTheme = (theme: 'system' | 'light' | 'dark') => {
		if (theme === 'system') {
			document.documentElement.removeAttribute('data-theme');
			localStorage.removeItem('theme');
			const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
			document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
		} else {
			document.documentElement.setAttribute('data-theme', theme);
			localStorage.setItem('theme', theme);
			themeChange(false);
		}
	};

	const registerPasskey = async () => {
		passkeyError = null;
		passkeyInfo = null;
		passkeyBusy = true;

		try {
			const optionsRes = await fetch('/api/passkeys/register/options', { method: 'POST' });
			const optionsJson = (await optionsRes.json()) as {
				options?: Parameters<typeof startRegistration>[0];
				error?: string;
			};
			if (!optionsRes.ok || !optionsJson.options) {
				throw new Error(optionsJson.error || "Impossible de démarrer l'enregistrement de la clé d'accès.");
			}

			const response = await startRegistration(optionsJson.options);
			const verifyRes = await fetch('/api/passkeys/register/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ response })
			});
			const verifyJson = (await verifyRes.json()) as { success?: boolean; message?: string; error?: string };
			if (!verifyRes.ok || !verifyJson.success) {
				throw new Error(verifyJson.error || verifyJson.message || "Impossible d'enregistrer la clé d'accès.");
			}

			passkeyInfo = verifyJson.message ?? "Clé d'accès enregistrée.";
			window.location.reload();
		} catch (error: unknown) {
			passkeyError =
				error instanceof Error ? error.message : "Erreur lors de l'enregistrement de la clé d'accès.";
		} finally {
			passkeyBusy = false;
		}
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
					return async function ({ result, update }) {
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

		<div class="card w-full items-center justify-between gap-4 bg-base-100 p-4 shadow-sm">
			{#if themeError}
				<div class="mb-4 alert alert-error">
					<span>{themeError}</span>
				</div>
			{/if}

			<form
        class="w-full"
				method="POST"
				action="?/updateTheme"
				use:enhance={() => {
					themeError = null;
					return async function ({ result, update }) {
						if (result.type === 'success') {
							await update();
							await loadUserData(); // Recharger les données utilisateur
							applyTheme(selectedTheme);
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
				<div class="flex w-full flex-col items-center justify-between gap-4 md:flex-row px-4">
					<label class="input box-content flex w-full">
						Thème
						<select
							data-choose-theme
							name="theme"
							class="select grow select-ghost bg-base-100 py-1 text-base-content ring-0 outline-none"
							bind:value={selectedTheme}
							required
							onchange={(e) => {
								const newTheme = e.currentTarget.value as 'system' | 'light' | 'dark';
								selectedTheme = newTheme;
								applyTheme(newTheme);

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

	<div class="flex flex-col gap-4">
		<h2 class="text-lg font-semibold text-base-content">Changer le mot de passe</h2>

		<div class="card w-full items-center justify-between gap-4 bg-base-100 p-8 shadow-sm">
			{#if passwordError}
				<div class="mb-4 alert alert-error w-full">
					<span>{passwordError}</span>
				</div>
			{/if}
			{#if passwordInfo}
				<div class="mb-4 alert alert-success w-full">
					<span>{passwordInfo}</span>
				</div>
			{/if}

			<form
				method="POST"
				action="?/changePassword"
				class="w-full"
				use:enhance={() => {
					passwordError = null;
					passwordInfo = null;
					return async ({ result, update, formElement }) => {
						if (result.type === 'success') {
							await update();
							passwordInfo = 'Mot de passe mis à jour avec succès.';
							if (formElement) formElement.reset();
						} else if (result.type === 'failure' && result.data) {
							const message =
								typeof result.data === 'object' && 'message' in result.data
									? String(result.data.message)
									: 'Erreur lors de la mise à jour du mot de passe';
							passwordError = message;
						}
					};
				}}
			>
				<div class="flex w-full flex-col gap-3">
					<input
						type="password"
						name="currentPassword"
						placeholder="Mot de passe actuel"
						class="input input-bordered w-full"
						autocomplete="current-password"
						required
					/>
					<input
						type="password"
						name="newPassword"
						placeholder="Nouveau mot de passe (min. 8 caractères)"
						class="input input-bordered w-full"
						autocomplete="new-password"
						minlength="8"
						required
					/>
					<input
						type="password"
						name="confirmPassword"
						placeholder="Confirmer le nouveau mot de passe"
						class="input input-bordered w-full"
						autocomplete="new-password"
						minlength="8"
						required
					/>
				</div>

				<div class="mt-4 flex justify-end">
					<button type="submit" class="btn btn-primary">Mettre à jour</button>
				</div>
			</form>
		</div>
	</div>

	<div class="flex flex-col gap-4">
		<h2 class="text-lg font-semibold text-base-content">Sécurité (2FA)</h2>

		<div class="card w-full items-center justify-between gap-4 bg-base-100 p-8 shadow-sm">
			{#if twoFactorError}
				<div class="mb-4 alert alert-error w-full">
					<span>{twoFactorError}</span>
				</div>
			{/if}
			{#if twoFactorInfo}
				<div class="mb-4 alert alert-success w-full">
					<span>{twoFactorInfo}</span>
				</div>
			{/if}

			<div class="w-full opacity-80">
				Statut: <strong>{$user?.twoFactorEnabled ? 'Activée' : 'Désactivée'}</strong>
			</div>

			{#if !$user?.twoFactorEnabled}
				<form
					method="POST"
					action="?/start2FASetup"
					class="w-full"
					use:enhance={() => {
						twoFactorError = null;
						twoFactorInfo = null;
						return async ({ result, update }) => {
							if (result.type === 'success') {
								await update();
								const dataResult = result.data as {
									message?: string;
									qrCodeDataUrl?: string;
									manualEntryKey?: string;
								};
								qrCodeDataUrl = dataResult.qrCodeDataUrl ?? null;
								manualEntryKey = dataResult.manualEntryKey ?? null;
								twoFactorInfo = dataResult.message ?? null;
							} else if (result.type === 'failure') {
								const dataResult = result.data as { message?: string };
								twoFactorError = dataResult.message ?? "Erreur lors de l'activation de la 2FA";
							}
						};
					}}
				>
					<button class="btn btn-primary" type="submit">Configurer la 2FA</button>
				</form>

				{#if qrCodeDataUrl && manualEntryKey}
					<div class="w-full rounded-box border border-base-300 p-4">
						<p class="mb-2 text-sm opacity-80">
							Scanne ce QR code dans ton application d'authentification (Google Authenticator, Aegis,
							Authy...) puis valide avec un code.
						</p>
						<img src={qrCodeDataUrl} alt="QR code 2FA" class="mb-3 h-48 w-48 rounded-box" />
						<p class="mb-3 text-sm">
							Clé manuelle: <code>{manualEntryKey}</code>
						</p>

						<form
							method="POST"
							action="?/confirm2FASetup"
							class="flex w-full items-end gap-2"
							use:enhance={() => {
								twoFactorError = null;
								twoFactorInfo = null;
								return async ({ result, update }) => {
									if (result.type === 'success') {
										await update();
										await loadUserData();
										qrCodeDataUrl = null;
										manualEntryKey = null;
										verificationCode = '';
										const dataResult = result.data as { message?: string };
										twoFactorInfo = dataResult.message ?? '2FA activée';
									} else if (result.type === 'failure') {
										const dataResult = result.data as { message?: string };
										twoFactorError = dataResult.message ?? 'Code 2FA invalide';
									}
								};
							}}
						>
							<label class="form-control grow">
								<span class="label-text mb-1">Code 2FA (6 chiffres)</span>
								<input
									name="code"
									class="input input-bordered"
									inputmode="numeric"
									maxlength="6"
									autocomplete="one-time-code"
									bind:value={verificationCode}
									required
								/>
							</label>
							<button class="btn btn-success" type="submit">Activer</button>
						</form>
					</div>
				{/if}
			{:else}
				<form
					method="POST"
					action="?/disable2FA"
					class="w-full rounded-box border border-base-300 p-4"
					use:enhance={() => {
						twoFactorError = null;
						twoFactorInfo = null;
						return async ({ result, update }) => {
							if (result.type === 'success') {
								await update();
								await loadUserData();
								disableCode = '';
								disablePassword = '';
								const dataResult = result.data as { message?: string };
								twoFactorInfo = dataResult.message ?? '2FA désactivée';
							} else if (result.type === 'failure') {
								const dataResult = result.data as { message?: string };
								twoFactorError = dataResult.message ?? 'Impossible de désactiver la 2FA';
							}
						};
					}}
				>
					<div class="mb-2 opacity-80">
						Pour désactiver la 2FA, confirme ton mot de passe et un code 2FA valide.
					</div>
					<div class="flex flex-col gap-2 md:flex-row">
						<input
							type="password"
							name="password"
							placeholder="Mot de passe"
							class="input input-bordered w-full"
							bind:value={disablePassword}
							required
						/>
						<input
							name="code"
							placeholder="Code 2FA"
							class="input input-bordered w-full md:w-48"
							inputmode="numeric"
							maxlength="6"
							bind:value={disableCode}
							required
						/>
						<button class="btn btn-error" type="submit">Désactiver</button>
					</div>
				</form>
			{/if}
		</div>
	</div>

	<div class="flex flex-col gap-4">
		<h2 class="text-lg font-semibold text-base-content">Clés d'accès (Passkeys)</h2>
		<div class="card w-full items-center justify-between gap-4 bg-base-100 p-8 shadow-sm">
			{#if passkeyError}
				<div class="mb-4 alert alert-error w-full">
					<span>{passkeyError}</span>
				</div>
			{/if}
			{#if passkeyInfo}
				<div class="mb-4 alert alert-success w-full">
					<span>{passkeyInfo}</span>
				</div>
			{/if}

			<div class="w-full opacity-80">
				Clés enregistrées: <strong>{data.passkeys?.length ?? 0}</strong>
			</div>

			<div class="w-full">
				<button class="btn btn-primary" type="button" onclick={registerPasskey} disabled={passkeyBusy}>
					{passkeyBusy ? "Enregistrement en cours..." : "Ajouter une clé d'accès"}
				</button>
			</div>

			{#if (data.passkeys?.length ?? 0) > 0}
				<div class="w-full overflow-x-auto">
					<table class="table table-zebra">
						<thead>
							<tr>
								<th>Créée le</th>
								<th>Dernière utilisation</th>
								<th class="text-right">Action</th>
							</tr>
						</thead>
						<tbody>
							{#each data.passkeys ?? [] as pk (pk.id)}
								<tr>
									<td>{new Date(pk.createdAt).toLocaleString('fr-FR')}</td>
									<td>{pk.lastUsedAt ? new Date(pk.lastUsedAt).toLocaleString('fr-FR') : 'Jamais'}</td>
									<td class="text-right">
										<form
											method="POST"
											action="?/removePasskey"
											use:enhance={() => {
												passkeyError = null;
												passkeyInfo = null;
												return async ({ result, update }) => {
													if (result.type === 'success') {
														await update();
														passkeyInfo = "Clé d'accès supprimée.";
														window.location.reload();
													} else if (result.type === 'failure') {
														const dataResult = result.data as { message?: string };
														passkeyError =
															dataResult.message ?? "Impossible de supprimer la clé d'accès.";
													}
												};
											}}
										>
											<input type="hidden" name="passkeyId" value={pk.id} />
											<button class="btn btn-sm btn-error" type="submit">Supprimer</button>
										</form>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
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
						return async function ({ result, update }) {
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
										const hiddenInput = form.querySelector('input[type="hidden"]');
										if (hiddenInput instanceof HTMLInputElement) {
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
				{#if switchUserError}
					<div class="mb-4 alert alert-error">
						<span>{switchUserError}</span>
					</div>
				{/if}
				<div class="flex w-full items-center justify-between gap-4">
					<span class="opacity-70"
						>Fonctionnalité permettant d'utiliser un autre compte utilisateur.</span
					>
				</div>
				<form
					method="POST"
					action="?/switchDevUser"
					class="w-full"
					use:enhance={() => {
						switchUserError = null;
						return async function ({ result, update }) {
							if (result.type === 'success') {
								await update();
								window.location.href = '/dashboard';
								return;
							}
							if (result.type === 'failure' && result.data) {
								switchUserError =
									typeof result.data === 'object' && 'message' in result.data
										? String(result.data.message)
										: "Erreur lors du changement d'utilisateur";
							}
						};
					}}
				>
					<div class="flex w-full flex-col items-center justify-between gap-4 md:flex-row">
						<label class="input box-content flex w-full">
							Utilisateur
							<select
								name="targetUserId"
								class="select h-[calc(100%-2px)] grow select-ghost bg-base-100 py-1 text-base-content ring-0 outline-none"
								bind:value={targetUserId}
							>
								{#each users as user (user.id)}
									<option value={user.id}>{user.username} ({user.role})</option>
								{/each}
							</select>
						</label>
						<button class="btn btn-primary" type="submit">Basculer</button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	{#if data.canReturnToOwnAccount}
		<div class="flex flex-col gap-4">
			<h2 class="text-lg font-semibold text-base-content">Retour au compte d'origine</h2>
			<div class="card w-full items-center justify-between gap-4 bg-base-100 p-8 shadow-sm">
				{#if returnUserError}
					<div class="mb-4 alert alert-error">
						<span>{returnUserError}</span>
					</div>
				{/if}
				<div class="flex w-full items-center justify-between gap-4">
					<span class="opacity-70">
						Session actuellement en mode dev.
						{#if data.devOriginUsername}
							Retour possible vers <strong>{data.devOriginUsername}</strong>.
						{/if}
					</span>
				</div>
				<form
					method="POST"
					action="?/returnToOwnAccount"
					class="w-full"
					use:enhance={() => {
						returnUserError = null;
						return async function ({ result, update }) {
							if (result.type === 'success') {
								await update();
								window.location.href = '/dashboard';
								return;
							}
							if (result.type === 'failure' && result.data) {
								returnUserError =
									typeof result.data === 'object' && 'message' in result.data
										? String(result.data.message)
										: 'Erreur lors du retour au compte';
							}
						};
					}}
				>
					<button class="btn btn-secondary" type="submit">Revenir à mon compte</button>
				</form>
			</div>
		</div>
	{/if}
</section>
