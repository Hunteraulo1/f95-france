<script lang="ts">
	import { user } from '$lib/stores';
	import { Bell, Check, CheckCheck } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	interface Notification {
		id: string;
		type: string;
		title: string;
		message: string;
		read: boolean;
		link: string | null;
		createdAt: Date | string;
		metadata: Record<string, unknown> | null;
	}

	let notifications = $state<Notification[]>([]);
	let unreadCount = $state(0);
	let isDrawerOpen = $state(false);
	let isLoading = $state(false);

	const fetchNotifications = async () => {
		if (!$user) return;

		try {
			isLoading = true;
			const response = await fetch('/api/notifications');
			if (response.ok) {
				const data = await response.json();
				notifications = data.notifications || [];
				unreadCount = data.unreadCount || 0;
			}
		} catch (error) {
			console.error('Erreur lors de la récupération des notifications:', error);
		} finally {
			isLoading = false;
		}
	};

	const markAsRead = async (notificationId: string) => {
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
			}
		} catch (error) {
			console.error('Erreur lors du marquage de toutes les notifications:', error);
		}
	};

	const handleNotificationClick = async (notification: Notification) => {
		if (!notification.read) {
			await markAsRead(notification.id);
		}

		if (notification.link) {
			isDrawerOpen = false;
			await goto(notification.link);
		}
	};

	const formatDate = (date: Date | string) => {
		const d = new Date(date);
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'À l\'instant';
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
		if (isDrawerOpen) {
			fetchNotifications();
		}
	});
</script>

<div class="dropdown dropdown-end">
	<button type="button" tabindex="0" class="btn btn-ghost btn-circle relative">
		<Bell size={20} />
		{#if unreadCount > 0}
			<span class="badge badge-sm badge-error absolute -top-1 -right-1 min-w-[18px] h-[18px] p-0 flex items-center justify-center">
				{unreadCount > 99 ? '99+' : unreadCount}
			</span>
		{/if}
	</button>
	<div
		class="dropdown-content menu bg-base-100 rounded-box z-[1] w-96 shadow-lg border border-base-300 mt-2"
	>
		<div class="p-4 border-b border-base-300 flex items-center justify-between">
			<h3 class="font-semibold text-lg">Notifications</h3>
			{#if unreadCount > 0}
				<button
					class="btn btn-ghost btn-sm"
					onclick={markAllAsRead}
					title="Tout marquer comme lu"
				>
					<CheckCheck size={16} />
				</button>
			{/if}
		</div>
		<div class="max-h-[500px] overflow-y-auto">
			{#if isLoading}
				<div class="p-8 text-center">
					<span class="loading loading-spinner loading-md"></span>
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
						class="w-full p-4 hover:bg-base-200 transition-colors border-b border-base-300 last:border-b-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary {notification.read
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
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 mb-1">
									<h4 class="font-semibold text-sm {notification.read ? '' : 'font-bold'}">
										{notification.title}
									</h4>
									{#if !notification.read}
										<div class="badge badge-primary badge-xs"></div>
									{/if}
								</div>
								<p class="text-sm text-base-content/70 line-clamp-2">{notification.message}</p>
								<p class="text-xs text-base-content/50 mt-1">{formatDate(notification.createdAt)}</p>
							</div>
							{#if !notification.read}
								<button
									type="button"
									class="btn btn-ghost btn-xs btn-circle"
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
