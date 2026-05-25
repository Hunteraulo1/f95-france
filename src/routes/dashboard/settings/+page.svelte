<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { effectivePermissions } from '$lib/permissions/client';
	import type { User } from '$lib/server/db/schema';
	import { loadUserData, updateUserData, user } from '$lib/stores';
	import { startRegistration } from '@simplewebauthn/browser';
	import { themeChange } from 'theme-change';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	type DevUserLite = Pick<User, 'id' | 'username' | 'role'>;
	let users = $state<DevUserLite[]>([]);
	let discordError = $state<string | null>(null);
	let discordInfo = $state<string | null>(null);
	let themeError = $state<string | null>(null);
	let directModeError = $state<string | null>(null);
	let switchUserError = $state<string | null>(null);
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
	let oauthDiscordFeedbackApplied = $state(false);
	$effect(() => {
		if ($user && $effectivePermissions.includes('dev.impersonate')) {
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

	$effect(() => {
		if (oauthDiscordFeedbackApplied) return;
		const oauthDiscordError = page.url.searchParams.get('discord_error');
		const oauthDiscordSuccess = page.url.searchParams.get('discord_success');

		if (oauthDiscordError) {
			discordError = oauthDiscordError;
			discordInfo = null;
			oauthDiscordFeedbackApplied = true;
		} else if (oauthDiscordSuccess) {
			discordInfo = oauthDiscordSuccess;
			discordError = null;
			oauthDiscordFeedbackApplied = true;
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
				throw new Error(
					optionsJson.error || "Impossible de démarrer l'enregistrement de la clé d'accès."
				);
			}

			const response = await startRegistration(optionsJson.options);
			const verifyRes = await fetch('/api/passkeys/register/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ response })
			});
			const verifyJson = (await verifyRes.json()) as {
				success?: boolean;
				message?: string;
				error?: string;
			};
			if (!verifyRes.ok || !verifyJson.success) {
				throw new Error(
					verifyJson.error || verifyJson.message || "Impossible d'enregistrer la clé d'accès."
				);
			}

			passkeyInfo = verifyJson.message ?? "Clé d'accès enregistrée.";
			window.location.reload();
		} catch (error: unknown) {
			passkeyError =
				error instanceof Error
					? error.message
					: "Erreur lors de l'enregistrement de la clé d'accès.";
		} finally {
			passkeyBusy = false;
		}
	};
</script>

<section class="flex flex-col gap-8">
	<div class="flex flex-col gap-4">
		<h2 class="text-lg font-semibold text-base-content">Discord</h2>

		<div class="card w-full border border-base-300 bg-base-100 shadow-xl">
			<div class="card-body gap-6 sm:py-8">
				<p class="text-sm text-base-content/70">
					Liez votre compte Discord pour les fonctionnalités qui en dépendent. Le pseudo et la photo
					de profil se modifient dans
					<a href="/dashboard/profile" class="link link-hover">Personnaliser le profil</a>.
				</p>

				{#if discordError}
					<div class="alert alert-error">
						<span>{discordError}</span>
					</div>
				{/if}
				{#if discordInfo}
					<div class="alert alert-success">
						<span>{discordInfo}</span>
					</div>
				{/if}

				<div
					class="flex w-full flex-col items-start justify-between gap-3 md:flex-row md:items-center"
				>
					<div class="flex justify-end">
						{#if $user?.discordId}
							<form
								class="w-full"
								method="POST"
								action="?/unlinkDiscord"
								use:enhance={() => {
									discordError = null;
									discordInfo = null;
									return async ({ result, update }) => {
										if (result.type === 'success') {
											await update();
											await loadUserData();
											discordInfo = 'Compte Discord délié avec succès.';
										} else if (result.type === 'failure' && result.data) {
											const message =
												typeof result.data === 'object' && 'message' in result.data
													? String(result.data.message)
													: 'Erreur lors du déliage Discord';
											discordError = message;
										}
									};
								}}
							>
								<button type="submit" class="btn btn-outline btn-error">Délier Discord</button>
							</form>
						{:else}
							<a href="/api/discord-oauth/authorize" class="btn btn-primary">Connexion Discord</a>
						{/if}
					</div>
					{#if $user?.discordId}
						<div class="text-sm text-base-content/80">
							Discord actuel : <strong>{$user.discordId}</strong>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<div class="flex flex-col gap-4">
		<h2 class="text-lg font-semibold text-base-content">Préférences utilisateur</h2>

		<div class="card w-full border border-base-300 bg-base-100 shadow-xl">
			<div class="card-body gap-6 sm:py-8">
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
					<div class="flex w-full flex-col items-center justify-between gap-4">
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
	</div>

	<div class="flex flex-col gap-4">
		<h2 class="text-lg font-semibold text-base-content">Changer le mot de passe</h2>

		<div class="card w-full border border-base-300 bg-base-100 shadow-xl">
			<div class="card-body gap-6 sm:py-8">
				{#if passwordError}
					<div class="mb-4 alert w-full alert-error">
						<span>{passwordError}</span>
					</div>
				{/if}
				{#if passwordInfo}
					<div class="mb-4 alert w-full alert-success">
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
							class="input-bordered input w-full"
							autocomplete="current-password"
							required
						/>
						<input
							type="password"
							name="newPassword"
							placeholder="Nouveau mot de passe (min. 8 caractères)"
							class="input-bordered input w-full"
							autocomplete="new-password"
							minlength="8"
							required
						/>
						<input
							type="password"
							name="confirmPassword"
							placeholder="Confirmer le nouveau mot de passe"
							class="input-bordered input w-full"
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
	</div>

	<div class="flex flex-col gap-4">
		<h2 class="text-lg font-semibold text-base-content">Sécurité (2FA)</h2>

		<div class="card w-full border border-base-300 bg-base-100 shadow-xl">
			<div class="card-body gap-6 sm:py-8">
				{#if twoFactorError}
					<div class="mb-4 alert w-full alert-error">
						<span>{twoFactorError}</span>
					</div>
				{/if}
				{#if twoFactorInfo}
					<div class="mb-4 alert w-full alert-success">
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
								Scanne ce QR code dans ton application d'authentification (Google Authenticator,
								Aegis, Authy...) puis valide avec un code.
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
										class="input-bordered input"
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
								class="input-bordered input w-full"
								bind:value={disablePassword}
								required
							/>
							<input
								name="code"
								placeholder="Code 2FA"
								class="input-bordered input w-full md:w-48"
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
	</div>

	<div class="flex flex-col gap-4">
		<h2 class="text-lg font-semibold text-base-content">Clés d'accès (Passkeys)</h2>
		<div class="card w-full border border-base-300 bg-base-100 shadow-xl">
			<div class="card-body gap-6 sm:p-8">
				{#if passkeyError}
					<div class="mb-4 alert w-full alert-error">
						<span>{passkeyError}</span>
					</div>
				{/if}
				{#if passkeyInfo}
					<div class="mb-4 alert w-full alert-success">
						<span>{passkeyInfo}</span>
					</div>
				{/if}

				<div class="w-full opacity-80">
					Clés enregistrées: <strong>{data.passkeys?.length ?? 0}</strong>
				</div>

				<div class="w-full">
					<button
						class="btn btn-primary"
						type="button"
						onclick={registerPasskey}
						disabled={passkeyBusy}
					>
						{passkeyBusy ? 'Enregistrement en cours...' : "Ajouter une clé d'accès"}
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
										<td
											>{pk.lastUsedAt
												? new Date(pk.lastUsedAt).toLocaleString('fr-FR')
												: 'Jamais'}</td
										>
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
	</div>

	{#if $user && data.canEditDirectMode}
		<div class="flex flex-col gap-4">
			<h2 class="text-lg font-semibold text-base-content">Mode d'enregistrement</h2>
			<div class="card w-full border border-base-300 bg-base-100 shadow-xl">
				<div class="card-body gap-6 sm:p-8">
					{#if directModeError}
						<div class="alert alert-error">
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
									const form = document.querySelector(
										'form[action*="updateDirectMode"]'
									) as HTMLFormElement | null;
									const hidden = form?.querySelector(
										'input[type="hidden"][name="directMode"]'
									) as HTMLInputElement | null;
									const enabled = hidden?.value === 'true';
									if ($user) {
										updateUserData({ ...$user, directMode: enabled });
									}
									await update();
									await loadUserData();
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
						<p class="text-sm opacity-70">
							Votre rôle utilise la préférence personnelle : activé, les ajouts et modifications
							sont appliqués directement ; désactivé, ils passent par une soumission en attente de
							validation.
						</p>
						<label class="label mt-4 cursor-pointer justify-start gap-4">
							<input
								type="checkbox"
								class="toggle toggle-primary"
								checked={$user?.directMode ?? true}
								onchange={(e) => {
									const form = e.currentTarget.closest('form');
									const hiddenInput = form?.querySelector(
										'input[type="hidden"][name="directMode"]'
									);
									if (hiddenInput instanceof HTMLInputElement) {
										hiddenInput.value = e.currentTarget.checked ? 'true' : 'false';
									}
									form?.requestSubmit();
								}}
							/>
							<span class="label-text">Mode direct</span>
							<input type="hidden" name="directMode" value={$user?.directMode ? 'true' : 'false'} />
						</label>
					</form>
				</div>
			</div>
		</div>
	{/if}

	{#if $user && $effectivePermissions.includes('dev.impersonate')}
		<div class="flex flex-col gap-4">
			<h2 class="text-lg font-semibold text-base-content">Changer d'utilisateur (Dev)</h2>

			<div class="card w-full border border-base-300 bg-base-100 shadow-xl">
				<div class="card-body gap-6 sm:p-8">
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
		</div>
	{/if}
</section>
