<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageServerData } from './$types';

	interface Props {
		form: ActionData & { errors?: Record<string, string> };
		data: PageServerData;
	}

	let { form, data }: Props = $props();
</script>

<div class="min-h-screen flex items-center justify-center bg-base-200">
	<div class="card w-full max-w-md bg-base-100 shadow-xl">
		<div class="card-body">
			<h2 class="card-title text-2xl font-bold text-center mb-4">
				Créer un compte
			</h2>
			<p class="text-center text-sm text-base-content/70 mb-6">
				Ou
				<a href="/dashboard/login" class="link link-primary">
					se connecter à votre compte existant
				</a>
			</p>
			
			<form method="post" action="?/register" use:enhance class="space-y-4">
				<div class="form-control">
					<label class="label" for="username">
						<span class="label-text">Nom d'utilisateur</span>
					</label>
					<input
						id="username"
						name="username"
						type="text"
						required
						class="input input-bordered w-full"
						placeholder="Nom d'utilisateur"
					/>
					{#if form?.errors?.username}
						<label class="label" for="username">
							<span class="label-text-alt text-error">{form.errors.username}</span>
						</label>
					{/if}
				</div>

				<div class="form-control">
					<label class="label" for="email">
						<span class="label-text">Adresse email</span>
					</label>
					<input
						id="email"
						name="email"
						type="email"
						required
						class="input input-bordered w-full"
						placeholder="Adresse email"
					/>
					{#if form?.errors?.email}
						<label class="label" for="email">
							<span class="label-text-alt text-error">{form.errors.email}</span>
						</label>
					{/if}
				</div>

				<div class="form-control">
					<label class="label" for="password">
						<span class="label-text">Mot de passe</span>
					</label>
					<input
						id="password"
						name="password"
						type="password"
						required
						class="input input-bordered w-full"
						placeholder="Mot de passe"
					/>
					{#if form?.errors?.password}
						<label class="label" for="password">
							<span class="label-text-alt text-error">{form.errors.password}</span>
						</label>
					{/if}
				</div>

				<div class="form-control">
					<label class="label" for="confirmPassword">
						<span class="label-text">Confirmer le mot de passe</span>
					</label>
					<input
						id="confirmPassword"
						name="confirmPassword"
						type="password"
						required
						class="input input-bordered w-full"
						placeholder="Confirmer le mot de passe"
					/>
					{#if form?.errors?.confirmPassword}
						<label class="label" for="confirmPassword">
							<span class="label-text-alt text-error">{form.errors.confirmPassword}</span>
						</label>
					{/if}
				</div>

				{#if form?.message}
					<div class="alert alert-error">
						<span>{form.message}</span>
					</div>
				{/if}

				<div class="form-control mt-6">
					<button type="submit" class="btn btn-primary">
						Créer le compte
					</button>
				</div>
			</form>
		</div>
	</div>
</div>
