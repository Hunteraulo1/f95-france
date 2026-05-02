<script>
	import { goto } from '$app/navigation';
	import { user } from '$lib/stores';
	import Bell from '@lucide/svelte/icons/bell';
	import Check from '@lucide/svelte/icons/check';
	import CheckCheck from '@lucide/svelte/icons/check-check';
	import { onMount } from 'svelte';

	/** @typedef {{ id: string; type: string; title: string; message: string; read: boolean; link: string | null; createdAt: Date | string; metadata: Record<string, unknown> | null }} Notification */

	/** @type {Notification[]} */
	let notifications = $state([]);
	let unreadCount = $state(0);
	let isDrawerOpen = $state(false);
	let isLoading = $state(false);
	let isUnauthorized = $state(false);

	const fetchNotifications = async () => {
		if (!$user || isUnauthorized) return;

		try {
			isLoading = true;
			const response = await fetch('/api/notifications');
			if (response.status === 401) {
				// Session expirée ou utilisateur non authentifié:
				// stopper les appels automatiques pour éviter le spam de 401.
				isUnauthorized = true;
				user.set(null);
				notifications = [];
				unreadCount = 0;
				return;
			}
			if (!response.ok) {
				return;
			}
			const data = await response.json();
			notifications = data.notifications || [];
			unreadCount = data.unreadCount || 0;
		} catch (error) {
			console.error('Erreur lors de la récupération des notifications:', error);
		} finally {
			isLoading = false;
		}
	};

	/** @param {string} notificationId */
	const markAsRead = async (notificationId) => {
		try {
			const response = await fetch('/api/notifications', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'markAsRead', notificationId })
			});

			if (response.ok) {
				// Mettre à jour localement
				notifications = notifications.map((n) =>
					n.id === notificationId ? { ...n, read: true } : n
				);
				unreadCount = Math.max(0, unreadCount - 1);
			} else if (response.status === 401) {
				isUnauthorized = true;
				user.set(null);
			}
		} catch (error) {
			console.error('Erreur lors du marquage de la notification:', error);
		}
	};

	const markAllAsRead = async () => {
		try {
			const response = await fetch('/api/notifications', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'markAllAsRead' })
			});

			if (response.ok) {
				notifications = notifications.map((n) => ({ ...n, read: true }));
				unreadCount = 0;
			} else if (response.status === 401) {
				isUnauthorized = true;
				user.set(null);
			}
		} catch (error) {
			console.error('Erreur lors du marquage de toutes les notifications:', error);
		}
	};

	/** @param {Notification} notification */
	const handleNotificationClick = async (notification) => {
		if (!notification.read) {
			await markAsRead(notification.id);
		}

		if (notification.link) {
			isDrawerOpen = false;
			// Chemins internes depuis l’API ; `goto` accepte une string (pas besoin de `resolve` sans `paths.base`).
			await goto(notification.link);
		}
	};

	/** @param {Date | string} date */
	const formatDate = (date) => {
		const d = new Date(date);
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return "À l'instant";
		if (diffMins < 60) return `Il y a ${diffMins} min`;
		if (diffHours < 24) return `Il y a ${diffHours}h`;
		if (diffDays < 7) return `Il y a ${diffDays}j`;
		return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
	};

	onMount(() => {
		fetchNotifications();
		// Rafraîchir les notifications toutes les 30 secondes
		const interval = setInterval(fetchNotifications, 30000);
		return () => clearInterval(interval);
	});

	$effect(() => {
		// Si l'utilisateur change (reconnexion), autoriser à nouveau les requêtes.
		if ($user) {
			isUnauthorized = false;
		}
	});

	$effect(() => {
		if (isDrawerOpen) {
			fetchNotifications();
		}
	});
</script>

<div class="dropdown dropdown-end">
	<button type="button" tabindex="0" class="btn relative btn-circle btn-ghost">
		<Bell size={20} />
		{#if unreadCount > 0}
			<span
				class="absolute -top-1 -right-1 badge flex h-[18px] min-w-[18px] items-center justify-center p-0 badge-sm badge-error"
			>
				{unreadCount > 99 ? '99+' : unreadCount}
			</span>
		{/if}
	</button>
	<div
		class="dropdown-content menu fixed z-1 mt-2 w-full border border-base-300 bg-base-100 shadow-lg xs:absolute xs:w-96 xs:rounded-box"
	>
		<div class="flex items-center justify-between border-b border-base-300 p-4">
			<h3 class="text-lg font-semibold">Notifications</h3>
			{#if unreadCount > 0}
				<button class="btn btn-ghost btn-sm" onclick={markAllAsRead} title="Tout marquer comme lu">
					<CheckCheck size={16} />
				</button>
			{/if}
		</div>
		<div class="max-h-[500px] overflow-y-auto">
			{#if isLoading}
				<div class="p-8 text-center">
					<span class="loading loading-md loading-spinner"></span>
				</div>
			{:else if notifications.length === 0}
				<div class="p-8 text-center text-base-content/60">
					<Bell size={48} class="mx-auto mb-2 opacity-30" />
					<p>Aucune notification</p>
				</div>
			{:else}
				{#each notifications as notification (notification.id)}
					<div
						role="button"
						tabindex="0"
						class="w-full cursor-pointer border-b border-base-300 p-4 transition-colors last:border-b-0 hover:bg-base-200 focus:ring-2 focus:ring-primary focus:outline-none {notification.read
							? ''
							: 'bg-base-200/50'}"
						onclick={() => handleNotificationClick(notification)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								handleNotificationClick(notification);
							}
						}}
					>
						<div class="flex items-start gap-3">
							<div class="min-w-0 flex-1">
								<div class="mb-1 flex items-center gap-2">
									<h4 class="text-sm font-semibold {notification.read ? '' : 'font-bold'}">
										{notification.title}
									</h4>
									{#if !notification.read}
										<div class="badge badge-xs badge-primary"></div>
									{/if}
								</div>
								<p class="line-clamp-2 text-sm text-base-content/70">{notification.message}</p>
								<p class="mt-1 text-xs text-base-content/50">
									{formatDate(notification.createdAt)}
								</p>
							</div>
							{#if !notification.read}
								<button
									type="button"
									class="btn btn-circle btn-ghost btn-xs"
									onclick={(e) => {
										e.stopPropagation();
										markAsRead(notification.id);
									}}
									onkeydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.stopPropagation();
										}
									}}
									title="Marquer comme lu"
								>
									<Check size={14} />
								</button>
							{/if}
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</div>
</div>
