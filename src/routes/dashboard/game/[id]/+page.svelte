<script lang="ts">
	import type { ScrapedF95Game } from '$lib/server/scrape/f95';
	import { newToast } from '$lib/stores';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import CalendarCheck2 from '@lucide/svelte/icons/calendar-check-2';
	import CalendarClock from '@lucide/svelte/icons/calendar-clock';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Gamepad2 from '@lucide/svelte/icons/gamepad-2';
	import Globe from '@lucide/svelte/icons/globe';
	import Plus from '@lucide/svelte/icons/plus';
	import RefreshCcw from '@lucide/svelte/icons/refresh-ccw';
	import Square from '@lucide/svelte/icons/square';
	import SquareCheckBig from '@lucide/svelte/icons/square-check-big';
	import SquarePen from '@lucide/svelte/icons/square-pen';
	import Tag from '@lucide/svelte/icons/tag';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { getGameEngineHexColor, getGameEngineLabel } from '$lib/utils/game-engine-colors';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const game = $derived(data.game);
	const translations = $derived(data.translations);
	const uniqueGameEngines = $derived([...new Set(translations.map((t) => t.gameType))]);
	const translators = $derived(data.translators);
	const currentUser = $derived(data.user);
	const canUseSilentMode = $derived(
		currentUser?.role === 'admin' || currentUser?.role === 'superadmin'
	);
	const canManageGameAutoCheck = $derived(
		currentUser?.role === 'admin' || currentUser?.role === 'superadmin'
	);
	const canShowRefreshButton = $derived(
		currentUser?.role === 'admin' || currentUser?.role === 'superadmin'
	);
	/** Actualisation manuelle depuis le thread : réservée aux jeux F95Zone */
	const refreshManualBlocked = $derived(game.website !== 'f95z');

	/**
	 * Peut activer l’auto-check sur une traduction : F95 + auto-check jeu.
	 * Si `ac` est true, l’auto-check jeu doit être actif ; l’inverse n’est pas vrai (traductions peuvent rester sans `ac`).
	 */
	const translationAcUiAllowed = $derived(game.website === 'f95z' && game.gameAutoCheck !== false);
	const canManuallyEditTranslationAc = $derived(canUseSilentMode && game.gameAutoCheck === true);
	/** Admins : afficher la case AC sur une fiche F95 (désactivée si l’auto-check jeu est off). */
	const canShowTranslationAcCheckbox = $derived(canUseSilentMode && game.website === 'f95z');

	// État pour le modal d'ajout de traduction
	let showAddTranslationModal = $state(false);
	let newTranslation = $state({
		translationName: '',
		version: '',
		tversion: '',
		status: 'in_progress',
		ttype: 'manual',
		gameType: 'other' as string,
		tlink: '',
		tname: 'translation',
		ac: false,
		translatorId: '',
		proofreaderId: ''
	});

	// État pour le modal de modification de traduction
	let showEditTranslationModal = $state(false);
	let editTranslationSilentMode = $state(false);
	let editingTranslation = $state({
		translationName: '',
		id: '',
		version: '',
		tversion: '',
		status: 'in_progress',
		ttype: 'manual',
		gameType: 'other' as string,
		tlink: '',
		tname: 'translation' as
			| 'no_translation'
			| 'integrated'
			| 'translation'
			| 'translation_with_mods',
		ac: false,
		translatorId: '',
		proofreaderId: ''
	});

	const editTranslationLinkNotRequired = $derived(
		editingTranslation.tname === 'integrated' || editingTranslation.tname === 'no_translation'
	);

	/** Auto-check actif : les versions suivent la fiche jeu et ne sont plus éditables (sauf cas intégrée / sans trad.). */
	const editTranslationVersionsLockedByAc = $derived(
		Boolean(editingTranslation.ac && translationAcUiAllowed)
	);

	const addTranslationTversionLocked = $derived(
		newTranslation.tname === 'integrated' || newTranslation.tname === 'no_translation'
	);

	// État pour la suppression
	let translationToDelete = $state<(typeof translations)[number] | null>(null);
	let translationDeleteReason = $state('');
	let gameToDelete = $state<boolean>(false);
	let gameDeleteReason = $state('');

	// État pour le modal de modification du jeu
	let showEditGameModal = $state(false);
	let editGameSilentMode = $state(false);
	let editingGame = $state({
		name: '',
		description: '',
		website: '',
		threadId: '',
		tags: '',
		link: '',
		image: '',
		gameAutoCheck: true,
		gameVersion: ''
	});

	const getStatusColor = (status: string) => {
		switch (status) {
			case 'completed':
				return 'badge-success';
			case 'in_progress':
				return 'badge-warning';
			case 'abandoned':
				return 'badge-error';
			default:
				return 'badge-neutral';
		}
	};

	const getStatusText = (status: string) => {
		switch (status) {
			case 'completed':
				return 'Terminé';
			case 'in_progress':
				return 'En cours';
			case 'abandoned':
				return 'Abandonné';
			default:
				return status;
		}
	};

	const getTtypeText = (ttype: string) => {
		switch (ttype) {
			case 'auto':
				return 'Automatique';
			case 'vf':
				return 'VO Française';
			case 'manual':
				return 'Manuelle';
			case 'semi-auto':
				return 'Semi-Automatique';
			case 'to_tested':
				return 'À tester';
			case 'hs':
				return 'Lien HS';
			default:
				return ttype;
		}
	};

	const gameEngineSelectValues = [
		'renpy',
		'rpgm',
		'unity',
		'unreal',
		'flash',
		'html',
		'qsp',
		'other'
	] as const;

	/** Valeur stockée en base : id traducteur, userId lié, ou legacy nom — pour affichage ou champs « nom ». */
	const getTranslatorDisplayName = (raw: string | null | undefined): string => {
		const key = raw == null ? '' : String(raw).trim();
		if (!key) return '';
		const byId = translators.find((t) => t.id === key);
		if (byId) return byId.name;
		const byName = translators.find((t) => t.name === key);
		if (byName) return byName.name;
		const byUserId = translators.find((t) => t.userId != null && t.userId === key);
		if (byUserId) return byUserId.name;
		return key;
	};

	/** Saisie traducteur/relecteur (nom affiché, id ou userId) → id en base. */
	const resolveTranslatorFormInputToId = (raw: string): string | null => {
		const key = raw.trim();
		if (!key) return null;
		const byName = translators.find((t) => t.name === key);
		if (byName) return byName.id;
		const byId = translators.find((t) => t.id === key);
		if (byId) return byId.id;
		const byUserId = translators.find((t) => t.userId != null && t.userId === key);
		if (byUserId) return byUserId.id;
		return null;
	};

	const normalizeTranslationProgressStatus = (
		s: string | undefined | null
	): 'in_progress' | 'completed' | 'abandoned' => {
		if (s === 'completed' || s === 'abandoned' || s === 'in_progress') return s;
		return 'in_progress';
	};

	const openAddTranslationModal = () => {
		newTranslation = {
			translationName: '',
			version: '',
			tversion: '',
			status: 'in_progress',
			ttype: 'manual',
			gameType: translations[0]?.gameType ?? 'other',
			tlink: '',
			tname: 'translation',
			ac: false,
			translatorId: '',
			proofreaderId: ''
		};
		showAddTranslationModal = true;
	};

	const closeAddTranslationModal = () => {
		showAddTranslationModal = false;
		newTranslation = {
			translationName: '',
			version: '',
			tversion: '',
			status: 'in_progress',
			ttype: 'manual',
			gameType: 'other',
			tlink: '',
			tname: 'translation',
			ac: false,
			translatorId: '',
			proofreaderId: ''
		};
	};

	// Réinitialiser le lien lorsque le statut change vers intégrée ou pas de traduction ;
	// « Pas de traduction » impose le type « hs » ; intégrée → version de traduction « Intégrée » (comme formulaire jeu)
	$effect(() => {
		if (newTranslation.tname === 'integrated' || newTranslation.tname === 'no_translation') {
			newTranslation.tlink = '';
		}
		if (newTranslation.tname === 'integrated') {
			newTranslation.tversion = 'Intégrée';
		} else if (newTranslation.tname === 'no_translation') {
			newTranslation.ttype = 'hs';
			newTranslation.tversion = '';
		} else if (newTranslation.tversion === 'Intégrée') {
			newTranslation.tversion = '';
		}
	});

	$effect(() => {
		if (!translationAcUiAllowed) {
			newTranslation.ac = false;
			editingTranslation.ac = false;
		}
	});

	/** Même logique que l’ajout : lien vide si intégrée / pas de traduction ; type hs si pas de traduction ; intégrée → tversion */
	$effect(() => {
		if (!showEditTranslationModal) return;
		if (
			editingTranslation.tname === 'integrated' ||
			editingTranslation.tname === 'no_translation'
		) {
			editingTranslation.tlink = '';
		}
		if (editingTranslation.tname === 'integrated') {
			editingTranslation.tversion = 'Intégrée';
		} else if (editingTranslation.tname === 'no_translation') {
			editingTranslation.ttype = 'hs';
			editingTranslation.tversion = '';
		} else if (editingTranslation.tversion === 'Intégrée') {
			editingTranslation.tversion = '';
		}
	});

	/** Auto-check traduction : aligner sur `game.gameVersion` (intégrée → seule la version de référence ; tversion reste « Intégrée »). */
	$effect(() => {
		if (!showEditTranslationModal) return;
		if (!editingTranslation.ac || !translationAcUiAllowed) return;
		if (editingTranslation.tname === 'no_translation') return;
		const gv = (game.gameVersion ?? '').trim();
		editingTranslation.version = gv;
		if (editingTranslation.tname !== 'integrated') {
			editingTranslation.tversion = gv;
		}
	});

	const refreshGame = async () => {
		if (game.website !== 'f95z') {
			newToast({
				alertType: 'warning',
				message: "L'actualisation manuelle n'est disponible que pour les jeux F95Zone."
			});
			return;
		}

		if (!game.threadId) {
			newToast({
				alertType: 'warning',
				message: "Ce jeu n'est pas lié à un thread compatible."
			});
			return;
		}

		/** Si une ligne a l’auto-check traduction, on la met à jour aussi ; sinon seule la fiche jeu est rafraîchie. */
		const acTranslation = translations.find((translation) => translation.ac);

		try {
			const response = await fetch('/dashboard/manager/scrape', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ threadId: game.threadId, website: game.website })
			});

			const payload = await response.json();

			if (!response.ok || !payload.success) {
				throw new Error(payload.error ?? 'Erreur lors du rafraîchissement');
			}

			const data = payload.data as ScrapedF95Game;

			if (!data.version) {
				newToast({
					alertType: 'warning',
					message: 'Version introuvable sur le thread, rafraîchissement annulé.'
				});
				return;
			}

			const gameUpdateRes = await fetch(`/dashboard/game/${game.id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					name: data.name ?? game.name,
					description: data.description ?? game.description ?? '',
					type: data.gameType ?? (translations[0]?.gameType as string | undefined) ?? 'other',
					website: game.website,
					threadId: game.threadId ? String(game.threadId) : '',
					tags: data.tags ?? game.tags ?? '',
					link: game.link ?? '',
					image: data.image ?? game.image ?? '',
					gameAutoCheck: game.gameAutoCheck ?? true,
					gameVersion: data.version ?? game.gameVersion ?? '',
					directMode: true
				})
			});

			if (!gameUpdateRes.ok) {
				const details = await gameUpdateRes.json().catch(() => ({}));
				throw new Error(
					(details as { error?: string }).error || 'Erreur lors de la mise à jour de la fiche jeu'
				);
			}

			showEditGameModal = true;
			editingGame = {
				...editingGame,
				name: data.name ?? game.name,
				tags: data.tags ?? game.tags,
				image: data.image ?? game.image,
				gameVersion: data.version
			};

			if (acTranslation) {
				const translationResponse = await fetch(
					`/dashboard/game/${game.id}/translations/${acTranslation.id}`,
					{
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							translationName: acTranslation.translationName,
							version: acTranslation.version ?? null,
							tversion: acTranslation.tversion,
							status: acTranslation.status,
							ttype: acTranslation.ttype,
							gameType: data.gameType ?? acTranslation.gameType,
							tlink: acTranslation.tlink ?? '',
							ac: acTranslation.ac ?? false,
							directMode: true
						})
					}
				);

				if (!translationResponse.ok) {
					const details = await translationResponse.json().catch(() => ({}));
					throw new Error(details.error || 'Erreur lors de la mise à jour de la traduction');
				}
			}

			newToast({
				alertType: 'success',
				message: acTranslation
					? 'Fiche jeu et traduction en auto-check rafraîchies'
					: 'Fiche jeu rafraîchie'
			});

			window.location.reload();
		} catch (error) {
			console.error('Erreur lors du rafraîchissement du jeu:', error);
			newToast({
				alertType: 'error',
				message: "Impossible d'actualiser ce jeu"
			});
		}
	};

	const addTranslation = async () => {
		// Validation des champs requis
		// Le lien n'est pas requis pour les traductions intégrées ou "pas de traduction"
		const linkNotRequired =
			newTranslation.tname === 'integrated' || newTranslation.tname === 'no_translation';
		if (!newTranslation.tversion || (!linkNotRequired && !newTranslation.tlink)) {
			newToast({
				alertType: 'error',
				message: linkNotRequired
					? 'Veuillez remplir tous les champs requis (version de traduction, statut, type)'
					: 'Veuillez remplir tous les champs requis (version de traduction, lien, etc.)'
			});
			return;
		}

		try {
			// Convertir les noms de traducteurs/relecteurs en IDs
			let translatorIdValue: string | null = null;
			let proofreaderIdValue: string | null = null;

			if (newTranslation.translatorId) {
				translatorIdValue = resolveTranslatorFormInputToId(newTranslation.translatorId);
				if (!translatorIdValue) {
					newToast({
						alertType: 'error',
						message: `Traducteur "${newTranslation.translatorId}" non trouvé`
					});
					return;
				}
			}

			if (newTranslation.proofreaderId) {
				proofreaderIdValue = resolveTranslatorFormInputToId(newTranslation.proofreaderId);
				if (!proofreaderIdValue) {
					newToast({
						alertType: 'error',
						message: `Relecteur "${newTranslation.proofreaderId}" non trouvé`
					});
					return;
				}
			}

			// Pour les traductions intégrées ou "pas de traduction", le lien doit être null
			const tlinkValue = linkNotRequired ? null : newTranslation.tlink;

			const payload = {
				translationName: newTranslation.translationName || null,
				version: newTranslation.version || null,
				tversion: newTranslation.tversion,
				status: newTranslation.status,
				ttype: newTranslation.ttype,
				gameType: newTranslation.gameType,
				tlink: tlinkValue,
				tname: newTranslation.tname,
				translatorId: translatorIdValue,
				proofreaderId: proofreaderIdValue
			};

			const response = await fetch(`/dashboard/game/${game.id}/translations`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(payload)
			});

			const data = await response.json();

			if (response.ok) {
				if (data.submission) {
					newToast({
						alertType: 'success',
						message: 'Soumission créée avec succès. Elle sera examinée par un administrateur.'
					});
				} else {
					newToast({
						alertType: 'success',
						message: 'Traduction ajoutée avec succès'
					});
				}
				closeAddTranslationModal();
				// Recharger la page pour voir la nouvelle traduction
				window.location.reload();
			} else {
				const errorMessage = data.error || "Erreur lors de l'ajout de la traduction";
				newToast({
					alertType: 'error',
					message: errorMessage
				});
			}
		} catch (error) {
			console.error("Erreur lors de l'ajout de la traduction:", error);
			newToast({
				alertType: 'error',
				message: "Une erreur est survenue lors de l'ajout de la traduction"
			});
		}
	};

	const openEditTranslationModal = (translation: (typeof translations)[number]) => {
		editTranslationSilentMode = false;
		editingTranslation = {
			translationName: translation.translationName || '',
			id: translation.id,
			version: translation.version || '',
			tversion: translation.tversion,
			status: normalizeTranslationProgressStatus(translation.status),
			ttype: translation.ttype,
			gameType: translation.gameType,
			tlink: translation.tlink,
			tname: translation.tname as (typeof editingTranslation)['tname'],
			translatorId: getTranslatorDisplayName(translation.translatorId),
			proofreaderId: getTranslatorDisplayName(translation.proofreaderId),
			ac: translation.ac ?? false
		};
		showEditTranslationModal = true;
	};

	const closeEditTranslationModal = () => {
		showEditTranslationModal = false;
		editTranslationSilentMode = false;
		editingTranslation = {
			translationName: '',
			id: '',
			version: '',
			tversion: '',
			status: 'in_progress',
			ttype: 'manual',
			gameType: 'other',
			tlink: '',
			tname: 'translation',
			ac: false,
			translatorId: '',
			proofreaderId: ''
		};
	};

	const editTranslation = async () => {
		const linkNotRequired = editTranslationLinkNotRequired;
		if (
			!editingTranslation.tversion ||
			!editingTranslation.status ||
			!editingTranslation.ttype ||
			(!linkNotRequired && !editingTranslation.tlink)
		) {
			newToast({
				alertType: 'error',
				message: linkNotRequired
					? 'Veuillez remplir les champs requis (version de traduction, statut, type)'
					: 'Veuillez remplir tous les champs requis (y compris le lien)'
			});
			return;
		}

		try {
			let translatorIdValue: string | null = null;
			let proofreaderIdValue: string | null = null;

			if (editingTranslation.translatorId) {
				translatorIdValue = resolveTranslatorFormInputToId(editingTranslation.translatorId);
				if (!translatorIdValue) {
					newToast({
						alertType: 'error',
						message: `Traducteur « ${editingTranslation.translatorId} » non trouvé`
					});
					return;
				}
			}

			if (editingTranslation.proofreaderId) {
				proofreaderIdValue = resolveTranslatorFormInputToId(editingTranslation.proofreaderId);
				if (!proofreaderIdValue) {
					newToast({
						alertType: 'error',
						message: `Relecteur « ${editingTranslation.proofreaderId} » non trouvé`
					});
					return;
				}
			}

			const tlinkValue = linkNotRequired ? null : editingTranslation.tlink;

			const payload = {
				translationName: editingTranslation.translationName || null,
				version: editingTranslation.version || null,
				tversion: editingTranslation.tversion,
				status: editingTranslation.status,
				ttype: editingTranslation.ttype,
				gameType: editingTranslation.gameType,
				tlink: tlinkValue,
				tname: editingTranslation.tname,
				ac: canManuallyEditTranslationAc ? editingTranslation.ac : undefined,
				translatorId: translatorIdValue,
				proofreaderId: proofreaderIdValue,
				silentMode: canUseSilentMode ? editTranslationSilentMode : false
			};

			const response = await fetch(
				`/dashboard/game/${game.id}/translations/${editingTranslation.id}`,
				{
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(payload)
				}
			);

			const data = (await response.json().catch(() => ({}))) as {
				error?: string;
				message?: string;
				submission?: boolean;
			};

			if (response.ok) {
				if (data.submission) {
					newToast({
						alertType: 'success',
						message: 'Soumission créée. Elle sera examinée par un administrateur.'
					});
				} else {
					newToast({ alertType: 'success', message: 'Traduction modifiée avec succès' });
				}
				closeEditTranslationModal();
				window.location.reload();
			} else {
				newToast({
					alertType: 'error',
					message: data.error || 'Erreur lors de la modification de la traduction'
				});
			}
		} catch (error) {
			console.error('Erreur lors de la modification de la traduction:', error);
			newToast({
				alertType: 'error',
				message: 'Une erreur est survenue lors de la modification de la traduction'
			});
		}
	};

	const confirmDeleteTranslation = (translation: (typeof translations)[number]) => {
		translationToDelete = translation;
		translationDeleteReason = '';
	};

	const cancelDeleteTranslation = () => {
		translationToDelete = null;
		translationDeleteReason = '';
	};

	const deleteTranslation = async () => {
		if (!translationToDelete) return;

		const reason = translationDeleteReason.trim();
		if (!reason) {
			newToast({
				alertType: 'error',
				message: 'La raison de la suppression est obligatoire'
			});
			return;
		}

		try {
			const response = await fetch(
				`/dashboard/game/${game.id}/translations/${translationToDelete.id}`,
				{
					method: 'DELETE',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ reason })
				}
			);

			const data = (await response.json().catch(() => ({}))) as {
				error?: string;
				message?: string;
				submission?: boolean;
			};

			if (response.ok) {
				if (data.submission) {
					newToast({
						alertType: 'success',
						message: 'Soumission de suppression créée. Elle sera examinée par un administrateur.'
					});
					cancelDeleteTranslation();
				} else {
					newToast({ alertType: 'success', message: 'Traduction supprimée' });
					translationToDelete = null;
					translationDeleteReason = '';
					window.location.reload();
				}
			} else {
				newToast({
					alertType: 'error',
					message: data.error || 'Erreur lors de la suppression de la traduction'
				});
			}
		} catch (error) {
			console.error('Erreur lors de la suppression de la traduction:', error);
			newToast({
				alertType: 'error',
				message: 'Erreur lors de la suppression de la traduction'
			});
		}
	};

	const confirmDeleteGame = () => {
		gameToDelete = true;
		gameDeleteReason = '';
	};

	const cancelDeleteGame = () => {
		gameToDelete = false;
		gameDeleteReason = '';
	};

	const deleteGame = async () => {
		const reason = gameDeleteReason.trim();
		if (!reason) {
			newToast({
				alertType: 'error',
				message: 'La raison de la suppression est obligatoire'
			});
			return;
		}

		try {
			const response = await fetch(`/dashboard/game/${game.id}`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ reason })
			});

			const data = (await response.json().catch(() => ({}))) as {
				error?: string;
				message?: string;
				submission?: boolean;
			};

			if (response.ok) {
				if (data.submission) {
					newToast({
						alertType: 'success',
						message: 'Soumission de suppression créée. Elle sera examinée par un administrateur.'
					});
					cancelDeleteGame();
				} else {
					newToast({ alertType: 'success', message: 'Jeu supprimé' });
					window.location.href = '/dashboard/manager';
				}
			} else {
				newToast({
					alertType: 'error',
					message: data.error || 'Erreur lors de la suppression du jeu'
				});
			}
		} catch (error) {
			console.error('Erreur lors de la suppression du jeu:', error);
			newToast({
				alertType: 'error',
				message: 'Erreur lors de la suppression du jeu'
			});
		}
	};

	const editGameAutoCheckAllowed = $derived(editingGame.website.trim() === 'f95z');

	$effect(() => {
		if (showEditGameModal && !editGameAutoCheckAllowed) {
			editingGame.gameAutoCheck = false;
		}
	});

	const openEditGameModal = () => {
		editGameSilentMode = false;
		const isF95 = game.website === 'f95z';
		editingGame = {
			name: game.name,
			description: game.description || '',
			website: game.website,
			threadId: game.threadId ? String(game.threadId) : '',
			tags: game.tags || '',
			link: game.link || '',
			image: game.image,
			gameAutoCheck: isF95 ? (game.gameAutoCheck ?? true) : false,
			gameVersion: game.gameVersion?.trim() || ''
		};
		showEditGameModal = true;
	};

	const closeEditGameModal = () => {
		showEditGameModal = false;
		editGameSilentMode = false;
		editingGame = {
			name: '',
			description: '',
			website: '',
			threadId: '',
			tags: '',
			link: '',
			image: '',
			gameAutoCheck: true,
			gameVersion: ''
		};
	};

	const editGame = async () => {
		try {
			const response = await fetch(`/dashboard/game/${game.id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					...editingGame,
					silentMode: canUseSilentMode ? editGameSilentMode : false
				})
			});

			if (response.ok) {
				// Fermer le modal
				closeEditGameModal();
				// Recharger la page pour voir les modifications
				window.location.reload();
			} else {
				const errorData = await response.json();
				alert(`Erreur lors de la modification du jeu: ${errorData.error || 'Erreur inconnue'}`);
			}
		} catch (error) {
			console.error('Erreur lors de la modification du jeu:', error);
			alert('Erreur de connexion lors de la modification du jeu');
		}
	};
</script>

<svelte:head>
	<title>{game.name} - F95 France</title>
	<meta name="description" content={game.description || `Détails du jeu ${game.name}`} />
</svelte:head>

<div class="min-h-screen bg-base-200">
	<div class="container mx-auto">
		<!-- Bouton retour -->
		<div class="absolute -mt-13">
			<a href="/dashboard/manager" class="btn btn-ghost">
				<ArrowLeft size={20} />
				Retour à la recherche
			</a>
		</div>

		<!-- En-tête du jeu -->
		<div class="card mb-8 bg-base-100 shadow-xl">
			<div class="card-body">
				<div class="flex flex-col gap-6 lg:flex-row">
					<!-- Image du jeu -->
					<div class="flex shrink-0 flex-col gap-4">
						<img
							src={game.image}
							alt={game.name}
							class="h-64 w-48 rounded-lg object-cover shadow-md"
							loading="lazy"
						/>
						<button class="btn btn-sm btn-primary" onclick={openEditGameModal}>
							<SquarePen size={16} />
							Modifier le jeu
						</button>
						{#if canShowRefreshButton}
							<button
								class="btn btn-sm btn-secondary"
								onclick={refreshGame}
								disabled={refreshManualBlocked}
								title={refreshManualBlocked
									? 'L’actualisation manuelle n’est disponible que pour les jeux F95Zone.'
									: undefined}
							>
								<RefreshCcw size={16} />
								Actualiser le jeu
							</button>
						{/if}
						<button class="btn btn-sm btn-error" onclick={confirmDeleteGame}>
							<Trash2 size={16} />
							Supprimer le jeu
						</button>
					</div>

					<!-- Informations du jeu -->
					<div class="flex-1">
						<h1 class="mb-4 text-3xl font-bold text-base-content">{game.name}</h1>

						{#if game.description}
							<p class="mb-4 leading-relaxed text-base-content/80">{game.description}</p>
						{/if}

						<div class="mb-4 flex flex-wrap gap-2">
							{#if uniqueGameEngines.length > 0}
								<span class="self-center text-xs font-medium text-base-content/60">Moteurs :</span>
								{#each uniqueGameEngines as eng (eng)}
									<span
										class="badge badge-lg border-0 text-white"
										style="background-color: {getGameEngineHexColor(eng)}"
										>{getGameEngineLabel(eng)}</span
									>
								{/each}
							{:else}
								<span class="badge badge-ghost badge-lg"
									>Aucune traduction (moteur non renseigné)</span
								>
							{/if}
							<span class="badge badge-lg badge-secondary">{game.website}</span>
							{#if game.threadId}
								<span class="badge badge-outline badge-lg">Thread #{game.threadId}</span>
							{/if}
							{#if game.gameVersion}
								<span class="badge badge-lg badge-accent" title="Version du jeu"
									>Version jeu : {game.gameVersion}</span
								>
							{/if}
						</div>

						{#if game.tags}
							<div class="mb-4">
								<div class="mb-2 flex items-center gap-2">
									<Tag size={16} />
									<span class="font-semibold">Tags</span>
								</div>
								<p class="text-sm text-base-content/70">{game.tags}</p>
							</div>
						{/if}

						<div class="mb-4 flex gap-2">
							{#if game.link}
								<a
									href={game.link}
									target="_blank"
									rel="noopener noreferrer"
									class="btn btn-outline btn-sm"
								>
									<ExternalLink size={16} />
									Lien du thread
								</a>
							{/if}
						</div>

						<div class="text-sm text-base-content/60">
							<div class="mb-1 flex items-center gap-2">
								<CalendarCheck2 size={14} />
								<span>Créé le {new Date(game.createdAt).toLocaleDateString('fr-FR')}</span>
							</div>
							<div class="flex items-center gap-2">
								<CalendarClock size={14} />
								<span>Modifié le {new Date(game.updatedAt).toLocaleDateString('fr-FR')}</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		{#if translations.length > 0}
			<div class="card bg-base-100 text-nowrap shadow-xl">
				<div class="card-body">
					<div class="mb-6 flex items-center justify-between">
						<h2 class="flex items-center gap-2 text-2xl font-bold text-base-content">
							<Globe size={24} />
							Traductions ({translations.length})
						</h2>
						<button class="btn btn-sm btn-primary" onclick={openAddTranslationModal}>
							<Plus size={16} />
							Ajouter une traduction
						</button>
					</div>

					<div class="overflow-x-auto">
						<table class="table w-full table-zebra">
							<thead>
								<tr>
									<th>Nom de la traduction</th>
									<th>Version de référence</th>
									<th>Version traduction</th>
									<th>Statut</th>
									<th>Moteur</th>
									<th>Type de traduction</th>
									<th>Lien de traduction</th>
									<th>Auto-Check</th>
									<th>Actions</th>
								</tr>
							</thead>
							<tbody>
								{#each translations as translation (translation.id)}
									<tr>
										<td class="font-bold">
											{translation.translationName || '—'}
											{#if translation.translatorId || translation.proofreaderId}
												<div class="mt-2 space-y-1 text-xs font-normal text-base-content/60">
													{#if translation.translatorId}
														<p>
															<strong>Traducteur :</strong>
															{getTranslatorDisplayName(translation.translatorId)}
														</p>
													{/if}
													{#if translation.proofreaderId}
														<p>
															<strong>Relecteur :</strong>
															{getTranslatorDisplayName(translation.proofreaderId)}
														</p>
													{/if}
												</div>
											{/if}
										</td>
										<td class="font-bold">{translation.version || game.gameVersion || '—'}</td>
										<td class="font-bold">{translation.tversion}</td>
										<td>
											<span class="badge {getStatusColor(translation.status)}">
												{getStatusText(translation.status)}
											</span>
										</td>
										<td>
											<span
												class="badge border-0 text-white"
												style="background-color: {getGameEngineHexColor(translation.gameType)}"
												>{getGameEngineLabel(translation.gameType)}</span
											>
										</td>
										<td>
											<span class="badge badge-info">
												{getTtypeText(translation.ttype)}
											</span>
										</td>
										<td>
											{#if translation.tlink}
												<a
													href={translation.tlink}
													target="_blank"
													rel="noopener noreferrer"
													class="btn btn-ghost btn-sm"
												>
													<ExternalLink size={14} />
													Lien
												</a>
											{/if}
										</td>
										<td>
											{#if translation.ac}
												<SquareCheckBig size={14} />
											{:else}
												<Square size={14} />
											{/if}
										</td>
										<td>
											<button
												class="btn btn-sm btn-primary"
												onclick={() => openEditTranslationModal(translation)}>Modifier</button
											>
											<button
												class="btn btn-sm btn-error"
												onclick={() => confirmDeleteTranslation(translation)}>Supprimer</button
											>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		{:else}
			<div class="card bg-base-100 shadow-xl">
				<div class="card-body text-center">
					<Gamepad2 size={48} class="mx-auto mb-4 text-base-content/40" />
					<h3 class="mb-2 text-xl font-semibold text-base-content">Aucune traduction</h3>
					<p class="mb-4 text-base-content/60">Ce jeu n'a pas encore de traduction disponible.</p>
					<button class="btn btn-primary" onclick={openAddTranslationModal}>
						<Plus size={16} />
						Ajouter une traduction
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Modal d'ajout de traduction -->
{#if showAddTranslationModal}
	<div class="modal-open modal">
		<div class="modal-box">
			<h3 class="mb-4 text-lg font-bold">Ajouter une traduction</h3>

			<div class="form-control mb-4 w-full">
				<label class="input" for="translationName">
					Nom de la traduction
					<input
						id="translationName"
						type="text"
						placeholder="Ex: Traduction française"
						class="w-full input-ghost"
						bind:value={newTranslation.translationName}
						required
					/>
				</label>
			</div>

			<div class="form-control mb-4 w-full">
				<label class="input" for="version">
					Version de référence
					<input
						id="version"
						type="text"
						placeholder="Ex: 1.2"
						class="w-full input-ghost"
						bind:value={newTranslation.version}
					/>
				</label>
				{#if newTranslation.tname === 'integrated' && translationAcUiAllowed && (game.gameVersion ?? '').trim()}
					<p class="mt-1 text-xs text-base-content/60">
						Traduction intégrée : l’auto-check à la création s’active si cette version est identique à
						la version du jeu sur la fiche ({(game.gameVersion ?? '').trim()}).
					</p>
				{/if}
			</div>

			<div class="form-control mb-4 w-full">
				<label class="input" for="tversion">
					Version de traduction
					<input
						id="tversion"
						type="text"
						placeholder="Ex: 1.0"
						class="w-full input-ghost"
						bind:value={newTranslation.tversion}
						disabled={addTranslationTversionLocked}
						required
					/>
				</label>
			</div>

			<div class="form-control mb-4 w-full">
				<label class="input pr-0" for="status">
					Statut
					<select
						id="status"
						class="w-full select-ghost"
						bind:value={newTranslation.status}
						required
					>
						<option value="in_progress">En cours</option>
						<option value="completed">Terminé</option>
						<option value="abandoned">Abandonné</option>
					</select>
				</label>
			</div>

			<div class="form-control mb-4 w-full">
				<label class="input pr-0" for="tname">
					Statut de traduction
					<select id="tname" class="w-full select-ghost" bind:value={newTranslation.tname} required>
						<option value="no_translation">Pas de traduction</option>
						<option value="integrated">Intégrée</option>
						<option value="translation">Traduction</option>
						<option value="translation_with_mods">Traduction avec mods</option>
					</select>
				</label>
			</div>

			<div class="form-control mb-4 w-full">
				<label class="input pr-0" for="new-game-type">
					Moteur du jeu
					<select
						id="new-game-type"
						class="w-full select-ghost"
						bind:value={newTranslation.gameType}
						required
					>
						{#each gameEngineSelectValues as v (v)}
							<option value={v}>{getGameEngineLabel(v)}</option>
						{/each}
					</select>
				</label>
			</div>

			<div class="form-control mb-4 w-full">
				<label class="input pr-0" for="ttype">
					Type de traduction
					<select
						id="ttype"
						class="w-full select-ghost"
						bind:value={newTranslation.ttype}
						disabled={newTranslation.tname === 'no_translation'}
						required
					>
						<option value="manual">Manuelle</option>
						<option value="auto">Automatique</option>
						<option value="semi-auto">Semi-Automatique</option>
						<option value="vf">VO Française</option>
						<option value="to_tested">À tester</option>
						<option value="hs">Lien HS</option>
					</select>
				</label>
			</div>

			<div class="form-control mb-6 w-full">
				<label class="input" for="tlink">
					Lien de traduction
					<input
						id="tlink"
						type="url"
						placeholder="https://..."
						class="w-full input-ghost"
						bind:value={newTranslation.tlink}
						disabled={newTranslation.tname === 'integrated' ||
							newTranslation.tname === 'no_translation'}
						required={newTranslation.tname !== 'integrated' &&
							newTranslation.tname !== 'no_translation'}
					/>
				</label>
			</div>

			<div class="form-control mb-6 w-full">
				<p class="mt-1 text-xs text-base-content/60">
					Auto-check traduction déterminé automatiquement à l’ajout (version trad = version jeu et
					auto-check jeu actif).
				</p>
			</div>

			<div class="grid gap-4 md:grid-cols-2">
				<div class="form-control">
					<label class="label" for="translation-translator">
						<span class="label-text">Traducteur</span>
					</label>
					<input
						id="translation-translator"
						class="input-bordered input"
						type="text"
						list="translation-translators"
						bind:value={newTranslation.translatorId}
						placeholder="Nom du traducteur"
					/>
					<datalist id="translation-translators">
						{#each translators as translator (translator.id)}
							<option value={translator.name}>{translator.name}</option>
						{/each}
					</datalist>
				</div>
				<div class="form-control">
					<label class="label" for="translation-proofreader">
						<span class="label-text">Relecteur</span>
					</label>
					<input
						id="translation-proofreader"
						class="input-bordered input"
						type="text"
						list="translation-proofreaders"
						bind:value={newTranslation.proofreaderId}
						placeholder="Nom du relecteur"
					/>
					<datalist id="translation-proofreaders">
						{#each translators as translator (translator.id)}
							<option value={translator.name}>{translator.name}</option>
						{/each}
					</datalist>
				</div>
			</div>

			<div class="modal-action">
				<button class="btn btn-ghost" onclick={closeAddTranslationModal}>Annuler</button>
				<button class="btn btn-primary" onclick={addTranslation}>Ajouter</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal de modification de traduction -->
{#if showEditTranslationModal}
	<div class="modal-open modal">
		<div class="modal-box">
			<h3 class="mb-4 text-lg font-bold">Modifier la traduction</h3>

			{#key editingTranslation.id}
				<div class="form-control mb-4 w-full">
					<label class="input" for="edit-translationName">
						Nom de la traduction
						<input
							id="edit-translationName"
							type="text"
							placeholder="Ex: Saison 1"
							class="w-full input-ghost"
							bind:value={editingTranslation.translationName}
							required
						/>
					</label>
				</div>

				<div class="form-control mb-4 w-full">
					<label class="input" for="edit-version">
						Version de référence
						<input
							id="edit-version"
							type="text"
							placeholder="Ex: 1.2"
							class="w-full input-ghost"
							bind:value={editingTranslation.version}
							disabled={editTranslationVersionsLockedByAc}
						/>
					</label>
					{#if editTranslationVersionsLockedByAc}
						<p class="mt-1 text-xs text-base-content/60">
							Alignée sur la version du jeu (fiche) — non modifiable tant que l’auto-check traduction
							est actif.
						</p>
					{/if}
				</div>

				<div class="form-control mb-4 w-full">
					<label class="input" for="edit-tversion">
						Version de traduction
						<input
							id="edit-tversion"
							type="text"
							placeholder="Ex: 1.0"
							class="w-full input-ghost"
							bind:value={editingTranslation.tversion}
							disabled={editTranslationLinkNotRequired || editTranslationVersionsLockedByAc}
							required
						/>
					</label>
					{#if editTranslationVersionsLockedByAc && !editTranslationLinkNotRequired}
						<p class="mt-1 text-xs text-base-content/60">
							Égale à la version du jeu — suivie automatiquement par l’auto-check.
						</p>
					{/if}
				</div>

				<div class="form-control mb-4 w-full">
					<label class="label" for="edit-status">
						<span class="label-text">Progression</span>
					</label>
					<select
						id="edit-status"
						class="select-bordered select w-full"
						bind:value={editingTranslation.status}
					>
						<option value="in_progress">En cours</option>
						<option value="completed">Terminé</option>
						<option value="abandoned">Abandonné</option>
					</select>
				</div>

				<div class="form-control mb-4 w-full">
					<label class="label" for="edit-tname">
						<span class="label-text">Statut de traduction</span>
					</label>
					<select
						id="edit-tname"
						class="select-bordered select w-full"
						bind:value={editingTranslation.tname}
					>
						<option value="no_translation">Pas de traduction</option>
						<option value="integrated">Intégrée</option>
						<option value="translation">Traduction</option>
						<option value="translation_with_mods">Traduction avec mods</option>
					</select>
				</div>

				<div class="form-control mb-4 w-full">
					<label class="label" for="edit-game-type">
						<span class="label-text">Moteur du jeu</span>
					</label>
					<select
						id="edit-game-type"
						class="select-bordered select w-full"
						bind:value={editingTranslation.gameType}
					>
						{#each gameEngineSelectValues as v (v)}
							<option value={v}>{getGameEngineLabel(v)}</option>
						{/each}
					</select>
				</div>

				<div class="form-control mb-4 w-full">
					<label class="label" for="edit-ttype">
						<span class="label-text">Type de traduction</span>
					</label>
					<select
						id="edit-ttype"
						class="select-bordered select w-full"
						bind:value={editingTranslation.ttype}
						disabled={editingTranslation.tname === 'no_translation'}
					>
						<option value="manual">Manuelle</option>
						<option value="auto">Automatique</option>
						<option value="semi-auto">Semi-Automatique</option>
						<option value="vf">VO Française</option>
						<option value="to_tested">À tester</option>
						<option value="hs">Lien HS</option>
					</select>
				</div>
			{/key}

			<div class="form-control mb-6 w-full">
				<label class="input" for="edit-tlink">
					Lien de traduction
					<input
						id="edit-tlink"
						type="url"
						placeholder="https://..."
						class="w-full input-ghost"
						bind:value={editingTranslation.tlink}
						disabled={editTranslationLinkNotRequired}
						required={!editTranslationLinkNotRequired}
					/>
				</label>
			</div>

			<div class="form-control mb-6 w-full">
				<div class="rounded-box border border-base-300 bg-base-200/30 p-3 text-sm text-base-content/80">
					{#if game.website !== 'f95z'}
						<p>
							L’auto-check traduction n’est prévu que pour les jeux <strong>F95Zone</strong>. Sur ce
							site, il reste désactivé.
						</p>
					{:else if game.gameAutoCheck === false}
						<p>
							L’<strong>auto-check du jeu</strong> est désactivé sur cette fiche. À l’enregistrement,
							l’auto-check de <strong>cette</strong> traduction sera donc mis à <strong>false</strong>
							(même si la ligne était marquée en auto-check auparavant).
						</p>
						{#if canManageGameAutoCheck}
							<p class="mt-2 text-base-content/70">
								Pour pouvoir l’activer ici : ouvrez <strong>Modifier le jeu</strong> (en haut de la
								page), puis cochez l’auto-check jeu pour ce thread F95.
							</p>
						{/if}
					{:else if canManuallyEditTranslationAc}
						<p>
							Vous pouvez activer l’auto-check sur cette ligne. S’il est actif, la version de
							référence suit le jeu ; pour une traduction <strong>intégrée</strong>, la Trad. Ver.
							reste « Intégrée ».
						</p>
					{:else}
						<p>
							L’auto-check de cette traduction n’est pas modifiable avec votre rôle ; la valeur en
							base est conservée si vous enregistrez les autres champs.
						</p>
					{/if}
				</div>
			</div>

			{#if canShowTranslationAcCheckbox}
				<div class="form-control mb-6 w-full">
					<label
						class="label cursor-pointer justify-start gap-3 {!canManuallyEditTranslationAc
							? 'opacity-70'
							: ''}"
					>
						<input
							type="checkbox"
							class="checkbox checkbox-sm"
							bind:checked={editingTranslation.ac}
							disabled={!canManuallyEditTranslationAc}
						/>
						<span class="label-text">Auto-check traduction</span>
					</label>
					{#if !canManuallyEditTranslationAc && game.website === 'f95z' && game.gameAutoCheck === false}
						<p class="mt-1 text-xs text-base-content/60">
							Réactivez d’abord l’auto-check du jeu pour cocher cette case.
						</p>
					{/if}
				</div>
			{/if}

			<div class="grid gap-4 md:grid-cols-2">
				<div class="form-control">
					<label class="label" for="edit-translator">
						<span class="label-text">Traducteur</span>
					</label>
					<input
						id="edit-translator"
						class="input-bordered input"
						type="text"
						list="edit-translator-list"
						bind:value={editingTranslation.translatorId}
						placeholder="Nom du traducteur"
					/>
					<datalist id="edit-translator-list">
						{#each translators as translator (translator.id)}
							<option value={translator.name}>{translator.name}</option>
						{/each}
					</datalist>
				</div>
				<div class="form-control">
					<label class="label" for="edit-proofreader">
						<span class="label-text">Relecteur</span>
					</label>
					<input
						id="edit-proofreader"
						class="input-bordered input"
						type="text"
						list="edit-proofreader-list"
						bind:value={editingTranslation.proofreaderId}
						placeholder="Nom du relecteur"
					/>
					<datalist id="edit-proofreader-list">
						{#each translators as translator (translator.id)}
							<option value={translator.name}>{translator.name}</option>
						{/each}
					</datalist>
				</div>
			</div>
			{#if canUseSilentMode}
				<div class="form-control mt-4">
					<label class="label cursor-pointer">
						<span class="label-text">Mode silencieux (sans notification Discord)</span>
						<input
							type="checkbox"
							class="toggle toggle-sm"
							bind:checked={editTranslationSilentMode}
						/>
					</label>
				</div>
			{/if}

			<div class="modal-action">
				<button class="btn btn-ghost" onclick={closeEditTranslationModal}>Annuler</button>
				<button class="btn btn-primary" onclick={editTranslation}>Modifier</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal de modification du jeu -->
{#if showEditGameModal}
	<div class="modal-open modal">
		<div class="modal-box max-w-2xl">
			<h3 class="mb-4 text-lg font-bold">Modifier le jeu</h3>

			<div class="grid grid-cols-2 gap-4">
				<div class="form-control col-span-2 w-full">
					<div class="rounded-box border border-base-300 bg-base-200/30 p-3 text-sm text-base-content/80">
						<p>
							Le <strong>moteur</strong> (Ren’Py, Unity, etc.) est défini
							<strong>par ligne de traduction</strong>
							: modifiez une traduction ou ajoutez-en une pour le renseigner.
						</p>
					</div>
				</div>
				<div class="form-control w-full">
					<label class="input" for="edit-game-name">
						Nom du jeu
						<input
							id="edit-game-name"
							type="text"
							placeholder="Nom du jeu"
							class="w-full input-ghost"
							bind:value={editingGame.name}
							required
						/>
					</label>
				</div>
				<div class="form-control w-full">
					<label class="input" for="edit-game-website">
						Site web
						<input
							id="edit-game-website"
							type="text"
							placeholder="Ex: F95Zone"
							class="w-full input-ghost"
							bind:value={editingGame.website}
							required
						/>
					</label>
				</div>
				<div class="form-control w-full">
					<label class="input" for="edit-game-threadId">
						ID du thread
						<input
							id="edit-game-threadId"
							type="text"
							placeholder="Ex: 12345"
							class="w-full input-ghost"
							bind:value={editingGame.threadId}
						/>
					</label>
				</div>
				<div class="form-control w-full">
					<label class="input" for="edit-game-gameVersion">
						Version du jeu
						<input
							id="edit-game-gameVersion"
							type="text"
							placeholder="Ex: 1.2.3 — build du jeu côté thread"
							class="w-full input-ghost"
							bind:value={editingGame.gameVersion}
						/>
					</label>
				</div>
				<div class="form-control w-full">
					<label class="input" for="edit-game-link">
						Lien du thread
						<input
							id="edit-game-link"
							type="url"
							placeholder="https://..."
							class="w-full input-ghost"
							bind:value={editingGame.link}
						/>
					</label>
				</div>
				<div class="form-control w-full">
					<label class="input" for="edit-game-image">
						URL de l'image
						<input
							id="edit-game-image"
							type="url"
							placeholder="https://..."
							class="w-full input-ghost"
							bind:value={editingGame.image}
							required
						/>
					</label>
				</div>
				<div class="grid grid-cols-2 gap-4 col-span-2 w-full mb-6">
          <div class="form-control w-full">
            <label for="edit-game-tags"> Tags </label>
            <textarea
              id="edit-game-tags"
              placeholder="Ex: 3D, Adventure, Romance"
              class="textarea h-full w-full"
              bind:value={editingGame.tags}
            ></textarea>
          </div>
          <div class="form-control w-full">
            <label for="edit-game-description"> Description </label>
            <textarea
              id="edit-game-description"
              placeholder="Description du jeu"
              class="textarea h-full w-full"
              bind:value={editingGame.description}
            ></textarea>
          </div>
				</div>
				{#if canManageGameAutoCheck}
					<div class="form-control col-span-2 w-full">
						<div class="rounded-box border border-base-300 bg-base-200/30 p-3 text-sm text-base-content/80">
							{#if editGameAutoCheckAllowed}
								<p>
									Si l’<strong>auto-check jeu</strong> est désactivé, aucune traduction ne pourra
									avoir l’auto-check. S’il est activé, ce n’est pas obligatoire sur chaque ligne :
									vous choisissez traduction par traduction.
								</p>
							{:else}
								<p>
									L’auto-check jeu n’est disponible que lorsque le site web du jeu est
									<strong>F95Zone</strong> (<code class="text-xs">f95z</code>). Passez le site en
									F95Zone pour pouvoir l’activer.
								</p>
							{/if}
						</div>
						<label
							class="label mt-4 cursor-pointer justify-start gap-3 {!editGameAutoCheckAllowed
								? 'opacity-70'
								: ''}"
							for="edit-game-autocheck"
						>
							<input
								id="edit-game-autocheck"
								type="checkbox"
								class="toggle toggle-sm"
								bind:checked={editingGame.gameAutoCheck}
								disabled={!editGameAutoCheckAllowed}
							/>
							<span class="label-text"
								>Auto-check jeu (autorise l’auto-check sur les traductions)</span
							>
						</label>
						{#if !editGameAutoCheckAllowed}
							<p class="mt-1 text-xs text-base-content/60">
								Choisissez le site F95Zone ci-dessus pour activer cette option.
							</p>
						{/if}
					</div>
				{/if}
				{#if canUseSilentMode}
					<div class="form-control col-span-2 w-full">
						<div class="rounded-box border border-base-300 bg-base-200/30 p-3 text-sm text-base-content/80">
							<p>
								Le <strong>mode silencieux</strong> évite d’envoyer une notification Discord lors
								de cette modification (y compris pour une traduction liée).
							</p>
						</div>
						<label class="label mt-4 cursor-pointer justify-start gap-3">
							<input type="checkbox" class="toggle toggle-sm" bind:checked={editGameSilentMode} />
							<span class="label-text">Mode silencieux (sans notification Discord)</span>
						</label>
					</div>
				{/if}
			</div>

			<div class="modal-action">
				<button class="btn btn-ghost" onclick={closeEditGameModal}>Annuler</button>
				<button class="btn btn-primary" onclick={editGame}>Modifier</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal de confirmation de suppression de traduction -->
{#if translationToDelete}
	<div class="modal-open modal">
		<div class="modal-box">
			<h3 class="mb-4 text-lg font-bold">Confirmer la suppression</h3>
			<p class="mb-6">Êtes-vous sûr de vouloir supprimer cette traduction ?</p>
			<div class="mb-6 rounded-lg bg-base-200 p-4">
				<p><strong>Version traduction:</strong> {translationToDelete.tversion}</p>
				<p><strong>Statut:</strong> {getStatusText(translationToDelete.status)}</p>
			</div>
			<div class="form-control mb-6 w-full">
				<label class="label" for="translation-delete-reason">
					<span class="label-text">Raison de la suppression <span class="text-error">*</span></span>
				</label>
				<textarea
					id="translation-delete-reason"
					class="textarea-bordered textarea min-h-24 w-full"
					placeholder="Expliquez pourquoi cette traduction doit être retirée…"
					bind:value={translationDeleteReason}
				></textarea>
			</div>
			<div class="modal-action">
				<button class="btn btn-ghost" onclick={cancelDeleteTranslation}>Annuler</button>
				<button class="btn btn-error" onclick={deleteTranslation}>Supprimer</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal de confirmation de suppression de jeu -->
{#if gameToDelete}
	<div class="modal-open modal">
		<div class="modal-box">
			<h3 class="mb-4 text-lg font-bold">Confirmer la suppression</h3>
			<p class="mb-6">Êtes-vous sûr de vouloir supprimer ce jeu ?</p>
			<div class="mb-6 rounded-lg bg-base-200 p-4">
				<p><strong>Nom:</strong> {game.name}</p>
				<p class="mt-2 text-error">
					<strong>Attention:</strong> Cette action supprimera également toutes les traductions associées
					à ce jeu.
				</p>
			</div>
			<div class="form-control mb-6 w-full">
				<label class="label" for="game-delete-reason">
					<span class="label-text">Raison de la suppression <span class="text-error">*</span></span>
				</label>
				<textarea
					id="game-delete-reason"
					class="textarea-bordered textarea min-h-24 w-full"
					placeholder="Expliquez pourquoi ce jeu doit être retiré…"
					bind:value={gameDeleteReason}
				></textarea>
			</div>
			<div class="modal-action">
				<button class="btn btn-ghost" onclick={cancelDeleteGame}>Annuler</button>
				<button class="btn btn-error" onclick={deleteGame}>Supprimer</button>
			</div>
		</div>
	</div>
{/if}
