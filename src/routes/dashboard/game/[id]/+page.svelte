<script lang="ts">
	import type { ScrapedThreadGame } from '$lib/server/scrape';
	import { newToast } from '$lib/stores';
	import { getGameEngineHexColor, getGameEngineLabel } from '$lib/utils/game-engine-colors';
	import { resolveGameImageSrc } from '$lib/utils/game-image-url';
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
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const game = $derived(data.game);
	const gameCoverSrc = $derived(resolveGameImageSrc(game.image, { website: game.website }));
	const translations = $derived(data.translations);
	const uniqueGameEngines = $derived([...new Set(translations.map((t) => t.gameType))]);
	const translators = $derived(data.translators);
	const currentUser = $derived(data.user);
	const isSuperAdmin = $derived(currentUser?.role === 'superadmin');
	const isAdmin = $derived(currentUser?.role === 'admin' || currentUser?.role === 'superadmin');
	const pendingSubmissions = $derived(data.pendingSubmissions ?? []);

	const submissionTypeLabel = (type: string, translationId: string | null): string => {
		if (type === 'update') return 'Modification du jeu';
		if (type === 'delete' && !translationId) return 'Suppression du jeu';
		if (type === 'delete' && translationId) return 'Suppression d’une traduction';
		if (type === 'translation' && translationId) return 'Modification d’une traduction';
		if (type === 'translation') return 'Ajout d’une traduction';
		return 'Soumission';
	};

	const formatSubmissionDate = (date: Date | string) =>
		new Date(date).toLocaleDateString('fr-FR', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	/** Actualisation manuelle depuis le thread : réservée aux jeux F95Zone */
	const refreshManualBlocked = $derived(game.website !== 'f95z');

	/**
	 * Peut activer l’auto-check sur une traduction : F95 + auto-check jeu.
	 * Si `ac` est true, l’auto-check jeu doit être actif ; l’inverse n’est pas vrai (traductions peuvent rester sans `ac`).
	 */
	const translationAcUiAllowed = $derived(game.website === 'f95z' && game.gameAutoCheck !== false);
	const canManuallyEditTranslationAc = $derived(isAdmin && game.gameAutoCheck === true);
	/** Admins : afficher la case AC sur une fiche F95 (désactivée si l’auto-check jeu est off). */
	const canShowTranslationAcCheckbox = $derived(isAdmin && game.website === 'f95z');

	// État pour le modal d'ajout de traduction
	let showAddTranslationModal = $state(false);
	let addTranslationSilentMode = $state(false);
	let newTranslation = $state({
		translationName: '',
		version: '',
		tversion: '',
		status: 'in_progress',
		ttype: 'auto',
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
		ttype: 'auto',
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

	/** Verrouillage des versions seulement pour les traductions intégrées en auto-check. */
	const editTranslationVersionsLockedByAc = $derived(
		Boolean(
			editingTranslation.ac && translationAcUiAllowed && editingTranslation.tname === 'integrated'
		)
	);
	const editTranslationReferenceVersionLockedByAc = $derived(
		Boolean(editingTranslation.ac && translationAcUiAllowed)
	);

	const addTranslationTversionLocked = $derived(
		newTranslation.tname === 'integrated' || newTranslation.tname === 'no_translation'
	);
	const addTranslationAutoCheckPreview = $derived.by(() => {
		const gv = (game.gameVersion ?? '').trim();
		const vv = (newTranslation.version ?? '').trim();
		const tname = (newTranslation.tname ?? 'translation').trim();

		if (game.website !== 'f95z' || game.gameAutoCheck === false) return false;

		return tname === 'integrated' || tname === 'no_translation' || (gv.length > 0 && vv === gv);
	});

	// État pour la suppression
	let translationToDelete = $state<(typeof translations)[number] | null>(null);
	let translationDeleteReason = $state('');
	let gameToDelete = $state<boolean>(false);
	let gameDeleteReason = $state('');

	// État pour le modal de modification du jeu
	let showEditGameModal = $state(false);
	let showEditGameImagePreview = $state(false);
	let showGameImagePopup = $state(false);
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

	/** Retourne le username de profil si le traducteur est lié à un compte. */
	const getTranslatorProfileRef = (raw: string | null | undefined): string | null => {
		const key = raw == null ? '' : String(raw).trim();
		if (!key) return null;
		const byId = translators.find((t) => t.id === key);
		if (byId?.username) return byId.username;
		const byName = translators.find((t) => t.name === key);
		if (byName?.username) return byName.username;
		const byUserId = translators.find((t) => t.userId != null && t.userId === key);
		if (byUserId?.username) return byUserId.username;
		return null;
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

	/** Valeur par défaut du champ traducteur pour l'utilisateur connecté (nom affiché attendu par le formulaire). */
	const getCurrentUserDefaultTranslatorInput = (): string => {
		const currentUserId = currentUser?.id ?? null;
		if (!currentUserId) return '';

		// Cas principal : traducteur lié au user via translator.userId
		const byUserId = translators.find((t) => t.userId != null && t.userId === currentUserId);
		if (byUserId?.name) return byUserId.name;

		// Compat legacy: si un champ translatorId/traductorId est présent sur l'objet user, l'accepter aussi.
		const linkedTranslatorRaw =
			(currentUser as { translatorId?: unknown; traductorId?: unknown })?.translatorId ??
			(currentUser as { traductorId?: unknown })?.traductorId;
		if (typeof linkedTranslatorRaw === 'string' && linkedTranslatorRaw.trim().length > 0) {
			return getTranslatorDisplayName(linkedTranslatorRaw);
		}

		return '';
	};

	const normalizeTranslationProgressStatus = (
		s: string | undefined | null
	): 'in_progress' | 'completed' | 'abandoned' => {
		if (s === 'completed' || s === 'abandoned' || s === 'in_progress') return s;
		return 'in_progress';
	};

	const openAddTranslationModal = () => {
		const defaultTranslatorInput = isAdmin ? '' : getCurrentUserDefaultTranslatorInput();
		addTranslationSilentMode = false;
		newTranslation = {
			translationName: '',
			version: '',
			tversion: '',
			status: 'in_progress',
			ttype: 'auto',
			gameType: translations[0]?.gameType ?? 'other',
			tlink: '',
			tname: 'translation',
			ac: false,
			translatorId: defaultTranslatorInput,
			proofreaderId: ''
		};
		showAddTranslationModal = true;
	};

	const closeAddTranslationModal = () => {
		showAddTranslationModal = false;
		addTranslationSilentMode = false;
		newTranslation = {
			translationName: '',
			version: '',
			tversion: '',
			status: 'in_progress',
			ttype: 'auto',
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

	/** Auto-check traduction : alignement automatique uniquement pour les traductions intégrées. */
	$effect(() => {
		if (!showEditTranslationModal) return;
		if (!editingTranslation.ac || !translationAcUiAllowed) return;
		if (editingTranslation.tname === 'no_translation') return;
		const gv = (game.gameVersion ?? '').trim();
		if (editingTranslation.tname === 'integrated') {
			editingTranslation.version = gv;
			editingTranslation.tversion = 'Intégrée';
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

			const data = payload.data as ScrapedThreadGame;

			if (!data.version) {
				newToast({
					alertType: 'warning',
					message: 'Version introuvable sur le thread, rafraîchissement annulé.'
				});
				return;
			}

			const checkerVersion = (data.version ?? '').trim();
			const wasAligned =
				checkerVersion.length > 0 &&
				checkerVersion === (game.gameVersion ?? '').trim() &&
				(!acTranslation ||
					(acTranslation.version ?? '').trim() === '' ||
					(acTranslation.version ?? '').trim() === checkerVersion);

			const gameUpdateRes = await fetch(`/dashboard/game/${game.id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					name: game.name,
					description: game.description ?? '',
					type: data.gameType ?? (translations[0]?.gameType as string | undefined) ?? 'other',
					website: game.website,
					threadId: game.threadId ? String(game.threadId) : '',
					tags: data.tags ?? game.tags ?? '',
					link: game.link ?? '',
					image: data.image ?? game.image ?? '',
					gameVersion: checkerVersion,
					f95VersionRefresh: true,
					directMode: true
				})
			});

			if (!gameUpdateRes.ok) {
				const details = await gameUpdateRes.json().catch(() => ({}));
				throw new Error(
					(details as { error?: string }).error || 'Erreur lors de la mise à jour de la fiche jeu'
				);
			}

			newToast({
				alertType: 'success',
				message: wasAligned
					? 'Version à jour : auto-check désactivé sur le jeu et les traductions'
					: acTranslation
						? 'Fiche jeu et versions de référence (auto-check) mises à jour'
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
		const requiresTranslationVersion = newTranslation.tname !== 'no_translation';
		if (
			(requiresTranslationVersion && !newTranslation.tversion) ||
			(!linkNotRequired && !newTranslation.tlink)
		) {
			newToast({
				alertType: 'error',
				message: linkNotRequired
					? requiresTranslationVersion
						? 'Veuillez remplir tous les champs requis (version de traduction, statut, type)'
						: 'Veuillez remplir tous les champs requis (statut, type)'
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
				proofreaderId: proofreaderIdValue,
				silentMode: isAdmin ? addTranslationSilentMode : false
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
		const requiresTranslationVersion = editingTranslation.tname !== 'no_translation';
		if (
			(requiresTranslationVersion && !editingTranslation.tversion) ||
			!editingTranslation.status ||
			!editingTranslation.ttype ||
			(!linkNotRequired && !editingTranslation.tlink)
		) {
			newToast({
				alertType: 'error',
				message: linkNotRequired
					? requiresTranslationVersion
						? 'Veuillez remplir les champs requis (version de traduction, statut, type)'
						: 'Veuillez remplir les champs requis (statut, type)'
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
				silentMode: isAdmin ? editTranslationSilentMode : false
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
		showEditGameImagePreview = false;
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
		showEditGameImagePreview = false;
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
					...editingGame
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
	<div class="container mx-auto flex flex-col gap-6">
		<!-- Bouton retour -->
		<div class="absolute -mt-13">
			<a href="/dashboard/manager" class="btn btn-ghost">
				<ArrowLeft size={20} />
				Retour à la recherche
			</a>
		</div>

		<!-- En-tête du jeu -->
		<div class="card w-full border border-base-300 bg-base-100 shadow-xl">
			<div class="card-body gap-6 sm:p-8">
				{#if pendingSubmissions.length > 0}
					<div role="alert" class="mb-4 alert alert-warning">
						<div class="flex-1">
							<div class="font-semibold">
								{pendingSubmissions.length} soumission{pendingSubmissions.length > 1 ? 's' : ''} en cours
								sur ce jeu
							</div>
							<ul class="mt-1 list-disc space-y-1 pl-5 text-sm opacity-90">
								{#each pendingSubmissions.slice(0, 3) as sub (sub.id)}
									<li>
										{submissionTypeLabel(sub.type, sub.translationId)}
										{#if sub.userId === currentUser?.id}
											· <span class="text-base-content/70">créée par</span>
											<span class="font-semibold">toi</span>
										{:else if sub.username}
											· <span class="text-base-content/70">créée par</span>
											<span class="font-semibold">{sub.username}</span>
										{/if}
										{#if sub.openedByUsername}
											· <span class="text-base-content/70">ouverte par</span>
											<span class="font-semibold">{sub.openedByUsername}</span>
										{/if}
										· {formatSubmissionDate(sub.createdAt)}
										{#if sub.status === 'opened'}
											· <span class="badge badge-xs badge-info">Ouverte</span>
										{/if}
									</li>
								{/each}
								{#if pendingSubmissions.length > 3}
									<li class="opacity-70">
										…et {pendingSubmissions.length - 3} autre{pendingSubmissions.length - 3 > 1
											? 's'
											: ''}
									</li>
								{/if}
							</ul>
						</div>
						{#if isAdmin}
							<a class="btn btn-outline btn-sm" href="/dashboard/submits?status=pending">
								Voir les soumissions
							</a>
						{/if}
					</div>
				{/if}
				<div class="flex flex-col gap-6 lg:flex-row">
					<!-- Image du jeu -->
					<div class="flex shrink-0 flex-col gap-4">
						{#if gameCoverSrc}
							<button
								type="button"
								class="rounded-lg transition outline-none hover:scale-[1.01] focus-visible:ring-2 focus-visible:ring-primary/60"
								aria-label="Ouvrir l'image du jeu en grand"
								onclick={() => {
									showGameImagePopup = true;
								}}
							>
								<img
									src={gameCoverSrc}
									alt={game.name}
									class="h-64 w-48 rounded-lg object-cover shadow-md"
									loading="lazy"
									referrerpolicy="no-referrer"
								/>
							</button>
						{:else if game.image?.trim()}
							<div
								class="flex h-64 w-48 items-center justify-center rounded-lg bg-base-200 px-3 text-center text-xs text-base-content/60"
								title="URL de page galerie (ex. ibb.co/…) — utiliser le lien direct i.ibb.co"
							>
								Vignette indisponible (lien galerie)
							</div>
						{/if}
						<button class="btn btn-sm btn-primary" onclick={openEditGameModal}>
							<SquarePen size={16} />
							Modifier le jeu
						</button>
						{#if isAdmin}
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
							{#if game.threadId}
								<button
									type="button"
									class="badge max-w-52 overflow-hidden badge-outline badge-lg hover:bg-base-200 sm:max-w-none"
									title="Copier l’ID du thread"
									onclick={() => {
										navigator.clipboard.writeText(String(game.threadId));
										newToast({
											alertType: 'success',
											message: 'ID du thread copié dans le presse-papiers'
										});
									}}
								>
									Thread #{game.threadId}
								</button>
							{/if}

							<span class="badge badge-lg badge-secondary">{game.website}</span>

							{#each uniqueGameEngines as eng (eng)}
								<span
									class="badge border-0 badge-lg text-white"
									style="background-color: {getGameEngineHexColor(eng)}"
									>{getGameEngineLabel(eng)}</span
								>
							{:else}
								<span
									class="badge badge-ghost badge-lg"
									title="Aucune traduction ou moteur non renseigné">Aucun moteur</span
								>
							{/each}

							{#if game.gameVersion}
								<span class="badge badge-lg badge-accent" title="Version du jeu"
									>Version jeu : {game.gameVersion}</span
								>
							{/if}
							{#if isSuperAdmin}
								<button
									type="button"
									class="badge max-w-52 overflow-hidden badge-outline badge-lg hover:bg-base-200 sm:max-w-none"
									title="Copier l’ID du jeu"
									onclick={() => {
										navigator.clipboard.writeText(game.id);
										newToast({
											alertType: 'success',
											message: 'ID du jeu copié dans le presse-papiers'
										});
									}}
								>
									ID: {game.id}
								</button>
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
			<div class="card w-full border border-base-300 bg-base-100 shadow-xl">
				<div class="card-body gap-6 sm:p-8">
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
														{@const translatorProfileRef = getTranslatorProfileRef(
															translation.translatorId
														)}
														<p>
															<strong>Traducteur :</strong>
															{#if translatorProfileRef}
																<a
																	class="link link-hover"
																	href={`/dashboard/profile/${translatorProfileRef}`}
																>
																	{getTranslatorDisplayName(translation.translatorId)}
																</a>
															{:else}
																{getTranslatorDisplayName(translation.translatorId)}
															{/if}
														</p>
													{/if}
													{#if translation.proofreaderId}
														{@const proofreaderProfileRef = getTranslatorProfileRef(
															translation.proofreaderId
														)}
														<p>
															<strong>Relecteur :</strong>
															{#if proofreaderProfileRef}
																<a
																	class="link link-hover"
																	href={`/dashboard/profile/${proofreaderProfileRef}`}
																>
																	{getTranslatorDisplayName(translation.proofreaderId)}
																</a>
															{:else}
																{getTranslatorDisplayName(translation.proofreaderId)}
															{/if}
														</p>
													{/if}
												</div>
											{/if}
										</td>
										<td class="font-bold">{translation.version || game.gameVersion || '—'}</td>
										<td class="font-bold">{translation.tversion}</td>
										<td>
											<span class="badge {getStatusColor(translation.status)} text-nowrap">
												{getStatusText(translation.status)}
											</span>
										</td>
										<td>
											<span
												class="badge border-0 text-nowrap text-white"
												style="background-color: {getGameEngineHexColor(translation.gameType)}"
												>{getGameEngineLabel(translation.gameType)}</span
											>
										</td>
										<td>
											<span class="badge text-nowrap badge-info">
												{getTtypeText(translation.ttype)}
											</span>
										</td>
										<td>
											{#if translation.tlink}
												<a
													href={translation.tlink}
													target="_blank"
													rel="noopener noreferrer"
													class="btn flex items-center justify-center btn-ghost btn-sm"
												>
													<ExternalLink size={14} />
													Lien
												</a>
											{/if}
										</td>
										<td>
											<div class="flex items-center justify-center">
												{#if translation.ac}
													<SquareCheckBig size={14} />
												{:else}
													<Square size={14} />
												{/if}
											</div>
										</td>
										<td>
											<div class="flex gap-2">
												<button
													class="btn btn-sm btn-primary"
													onclick={() => openEditTranslationModal(translation)}>Modifier</button
												>
												<button
													class="btn btn-sm btn-error"
													onclick={() => confirmDeleteTranslation(translation)}>Supprimer</button
												>
											</div>
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
		<div class="modal-box max-h-[90vh] max-w-7xl overflow-y-auto">
			<div class="mb-5">
				<h3 class="text-lg font-bold">Ajouter une traduction</h3>
				<p class="mt-1 text-sm text-base-content/70">
					Même structure que la modification : renseignez le type de traduction en premier —
					certains champs se désactivent seuls (intégrée, pas de traduction).
				</p>
				<div class="mt-3 flex flex-wrap gap-2">
					<span class="badge badge-outline">Statut: {getStatusText(newTranslation.status)}</span>
					<span class="badge badge-outline">Type: {getTtypeText(newTranslation.ttype)}</span>
					<span class="badge badge-outline">
						Moteur: {getGameEngineLabel(newTranslation.gameType)}
					</span>
				</div>
			</div>

			<div class="rounded-box border border-base-300 bg-base-200/30 p-4">
				<div class="mb-3">
					<h4 class="text-sm font-semibold text-base-content/80">Informations principales</h4>
				</div>
				<div class="grid gap-4 md:grid-cols-2">
					<div class="form-control w-full md:col-span-2">
						<label class="input" for="add-tr-translationName">
							Nom de la traduction
							<input
								id="add-tr-translationName"
								type="text"
								placeholder="Ex: Saison 1, VF communauté…"
								class="w-full input-ghost"
								bind:value={newTranslation.translationName}
								required
							/>
						</label>
						<p class="mt-1 text-xs text-base-content/60">
							Nom court et reconnaissable (Épisode 2, Saison 2, Chapitre 2, etc.).
						</p>
					</div>

					<div class="form-control w-full">
						<label class="label" for="add-tr-tname">
							<span class="label-text">Statut de traduction</span>
						</label>
						<select
							id="add-tr-tname"
							class="select-bordered select w-full"
							bind:value={newTranslation.tname}
							required
						>
							<option value="no_translation">Pas de traduction</option>
							<option value="integrated">Intégrée</option>
							<option value="translation">Traduction</option>
							<option value="translation_with_mods">Traduction avec mods</option>
						</select>
					</div>

					<div class="form-control w-full">
						<label class="label" for="add-tr-status">
							<span class="label-text">Progression</span>
						</label>
						<select
							id="add-tr-status"
							class="select-bordered select w-full"
							bind:value={newTranslation.status}
							required
						>
							<option value="in_progress">En cours</option>
							<option value="completed">Terminé</option>
							<option value="abandoned">Abandonné</option>
						</select>
					</div>

					<div class="form-control w-full">
						<label class="label" for="add-tr-ttype">
							<span class="label-text">Type de traduction</span>
						</label>
						<select
							id="add-tr-ttype"
							class="select-bordered select w-full"
							bind:value={newTranslation.ttype}
							disabled={newTranslation.tname === 'no_translation'}
							required
						>
							<option value="vf">VO Française</option>
							<option value="manual">Traduction humaine</option>
							<option value="semi-auto">Traduction semi-automatique</option>
							<option value="auto">Traduction automatique</option>
							<option value="to_tested">À tester</option>
							<option value="hs">Lien trad HS</option>
						</select>
					</div>

					<div class="form-control w-full">
						<label class="label" for="add-tr-game-type">
							<span class="label-text">Moteur du jeu</span>
						</label>
						<select
							id="add-tr-game-type"
							class="select-bordered select w-full"
							bind:value={newTranslation.gameType}
							required
						>
							{#each gameEngineSelectValues as v (v)}
								<option value={v}>{getGameEngineLabel(v)}</option>
							{/each}
						</select>
					</div>
				</div>
			</div>

			<div class="divider my-5">Versions et lien</div>
			<div class="rounded-box border border-base-300 bg-base-200/30 p-4">
				<div class="grid gap-4 md:grid-cols-2">
					<div class="form-control w-full">
						<label class="label" for="add-tr-version">
							<span class="label-text">Version de référence</span>
						</label>
						<div class="join join-horizontal w-full">
							<input
								id="add-tr-version"
								type="text"
								placeholder="Ex: 1.2"
								class="input-bordered input join-item min-w-0 flex-1"
								bind:value={newTranslation.version}
							/>
							<button
								type="button"
								class="btn join-item shrink-0 btn-outline"
								disabled={!(game.gameVersion ?? '').trim()}
								onclick={() => {
									const latest = (game.gameVersion ?? '').trim();
									if (!latest) return;
									newTranslation.version = latest;
								}}
							>
								Copier
							</button>
						</div>
						<p class="mt-1 text-xs text-base-content/60">
							Dernière version de la Saison/Épisode/Chapitre/... sortie.
						</p>
						{#if newTranslation.tname === 'integrated' && translationAcUiAllowed && (game.gameVersion ?? '').trim()}
							<p class="mt-1 text-xs text-base-content/60">
								Intégrée : l’auto-check à la création s’active si cette version est identique à la
								version du jeu sur la fiche ({(game.gameVersion ?? '').trim()}).
							</p>
						{/if}
					</div>

					<div class="form-control w-full">
						<label class="label" for="add-tr-tversion">
							<span class="label-text">Version de traduction</span>
						</label>
						<input
							id="add-tr-tversion"
							type="text"
							placeholder="Ex: 1.0"
							class="input-bordered input w-full"
							bind:value={newTranslation.tversion}
							disabled={addTranslationTversionLocked}
							required
						/>
						<p class="mt-1 text-xs text-base-content/60">
							Version de la traduction. Doit être identique à la version de référence pour être à
							jour.
						</p>
					</div>

					<div class="form-control w-full md:col-span-2">
						<label class="label" for="add-tr-tlink">
							<span class="label-text">Lien de traduction</span>
						</label>
						<div class="join join-horizontal w-full">
							<input
								id="add-tr-tlink"
								type="url"
								placeholder="https://…"
								class="input-bordered input join-item min-w-0 flex-1"
								bind:value={newTranslation.tlink}
								disabled={newTranslation.tname === 'integrated' ||
									newTranslation.tname === 'no_translation'}
								required={newTranslation.tname !== 'integrated' &&
									newTranslation.tname !== 'no_translation'}
							/>
							<button
								type="button"
								class="btn join-item shrink-0 btn-outline"
								disabled={newTranslation.tname === 'integrated' ||
									newTranslation.tname === 'no_translation' ||
									!newTranslation.tlink?.trim()}
								aria-label="Ouvrir le lien dans un nouvel onglet"
								onclick={() => {
									const u = newTranslation.tlink?.trim();
									if (u) window.open(u, '_blank', 'noopener,noreferrer');
								}}
							>
								Ouvrir
							</button>
						</div>
						<p class="mt-1 text-xs text-base-content/60">
							Lien direct vers la publication/source de la traduction.
						</p>
					</div>
				</div>
			</div>

			{#if isAdmin}
				<div class="mt-5 rounded-box border border-base-300 bg-base-200/30 p-4 md:p-5">
					<div class="mb-4">
						<h4 class="text-sm font-semibold text-base-content/80">Auto-check</h4>
					</div>
					<div class="form-control mb-4 w-full">
						<div
							class="rounded-box border border-base-300 bg-base-100/70 p-4 text-sm text-base-content/80"
						>
							{#if game.website !== 'f95z'}
								<p>
									L’auto-check traduction n’est prévu que pour les jeux <strong>F95Zone</strong>.
									Sur ce site, il reste désactivé.
								</p>
							{:else if game.gameAutoCheck === false}
								<p>
									L’<strong>auto-check du jeu</strong> est désactivé sur cette fiche. À la création,
									l’auto-check de cette traduction sera donc mis à <strong>false</strong>.
								</p>
								<p class="mt-2 text-base-content/70">
									Pour le réactiver : ouvrez <strong>Modifier le jeu</strong> et cochez l’auto-check jeu.
								</p>
							{:else}
								<p>
									L’auto-check est calculé automatiquement à la création :
									<strong>true</strong> si la traduction est <strong>Intégrée</strong>,
									<strong>Pas de traduction</strong> ou si la version de référence est égale à la version
									du jeu.
								</p>
							{/if}
						</div>
					</div>

					<label
						class="label cursor-pointer justify-start gap-3 rounded-box border border-base-300 bg-base-100/70 px-3 py-2 opacity-70"
					>
						<input
							type="checkbox"
							class="checkbox checkbox-sm"
							checked={addTranslationAutoCheckPreview}
							disabled
						/>
						<span class="label-text">Auto-check traduction (aperçu automatique)</span>
					</label>
					<p class="mt-1 text-xs text-base-content/60">
						Ce statut est informatif : il est recalculé côté serveur lors de l’enregistrement.
					</p>
				</div>
			{/if}

			<div class="divider my-5">Contributeurs</div>
			<div class="rounded-box border border-base-300 bg-base-200/30 p-4">
				<div class="grid gap-4 md:grid-cols-2">
					<div class="form-control w-full">
						<label class="label" for="add-tr-translator">
							<span class="label-text">Traducteur</span>
						</label>
						<input
							id="add-tr-translator"
							class="input-bordered input w-full"
							type="text"
							list="add-tr-translators-list"
							bind:value={newTranslation.translatorId}
							placeholder="Nom du traducteur"
						/>
						<datalist id="add-tr-translators-list">
							{#each translators as translator (translator.id)}
								<option value={translator.name}>{translator.name}</option>
							{/each}
						</datalist>
					</div>
					<div class="form-control w-full">
						<label class="label" for="add-tr-proofreader">
							<span class="label-text">Relecteur</span>
						</label>
						<input
							id="add-tr-proofreader"
							class="input-bordered input w-full"
							type="text"
							list="add-tr-proofreaders-list"
							bind:value={newTranslation.proofreaderId}
							placeholder="Nom du relecteur"
						/>
						<datalist id="add-tr-proofreaders-list">
							{#each translators as translator (translator.id)}
								<option value={translator.name}>{translator.name}</option>
							{/each}
						</datalist>
					</div>
				</div>
			</div>

			{#if isAdmin}
				<div
					class="mt-5 flex w-full flex-wrap items-center justify-between gap-3 rounded-box bg-base-200/60 px-4 py-3"
				>
					<p class="text-sm text-base-content/80">
						Désactive l'envoi d'une notification sur Discord.
					</p>
					<label class="label cursor-pointer gap-2 p-0">
						<span class="label-text">Mode silencieux</span>
						<input
							type="checkbox"
							class="toggle toggle-primary toggle-sm"
							checked={addTranslationSilentMode}
							onchange={() => {
								addTranslationSilentMode = !addTranslationSilentMode;
							}}
						/>
					</label>
				</div>
			{/if}

			<div
				class="sticky right-0 bottom-0 left-0 modal-action mt-6 w-full border-t border-base-300 bg-base-100/95 p-4 pt-4 backdrop-blur"
			>
				<button type="button" class="btn btn-ghost" onclick={closeAddTranslationModal}>
					Annuler
				</button>
				<button type="button" class="btn btn-primary" onclick={addTranslation}>Ajouter</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal de modification de traduction -->
{#if showEditTranslationModal}
	<div class="modal-open modal">
		<div class="modal-box max-h-[90vh] max-w-7xl p-0">
			<div class="p-8">
				<h3 class="text-lg font-bold">Modifier la traduction</h3>
				<p class="mt-1 text-sm text-base-content/70">
					Mettez à jour la ligne de traduction sans perdre les informations existantes.
				</p>
			</div>

			<div class="space-y-5 overflow-y-auto px-8">
				{#if isSuperAdmin}
					<div class="mb-4">
						<button
							type="button"
							class="badge max-w-full overflow-hidden badge-outline text-left badge-sm hover:bg-base-200"
							title="Copier l’ID de la traduction"
							onclick={() => {
								navigator.clipboard.writeText(editingTranslation.id);
								newToast({
									alertType: 'success',
									message: 'ID de la traduction copié dans le presse-papiers'
								});
							}}
						>
							ID: {editingTranslation.id}
						</button>
					</div>
				{/if}

				{#key editingTranslation.id}
					<div class="space-y-5">
						<div class="rounded-box border border-base-300 bg-base-200/30 p-4 md:p-5">
							<div class="mb-4">
								<h4 class="text-sm font-semibold text-base-content/80">Informations principales</h4>
							</div>
							<div class="grid gap-4 md:grid-cols-2">
								<div class="form-control w-full md:col-span-2">
									<label class="label" for="edit-translationName">
										<span class="label-text">Nom de la traduction</span>
									</label>
									<input
										id="edit-translationName"
										type="text"
										placeholder="Ex: Saison 1"
										class="input-bordered input w-full"
										bind:value={editingTranslation.translationName}
										required
									/>
								</div>

								<div class="form-control w-full">
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
									<p class="mt-1 text-xs text-base-content/60">
										Définit les contraintes de version et si le lien devient optionnel.
									</p>
								</div>

								<div class="form-control w-full">
									<label class="label" for="edit-status">
										<span class="label-text">Progression</span>
									</label>
									<select
										id="edit-status"
										class="select-bordered select w-full text-nowrap"
										bind:value={editingTranslation.status}
									>
										<option value="in_progress">En cours</option>
										<option value="completed">Terminé</option>
										<option value="abandoned">Abandonné</option>
									</select>
								</div>

								<div class="form-control w-full">
									<label class="label" for="edit-ttype">
										<span class="label-text">Type de traduction</span>
									</label>
									<select
										id="edit-ttype"
										class="select-bordered select w-full"
										bind:value={editingTranslation.ttype}
										disabled={editingTranslation.tname === 'no_translation'}
									>
										<option value="vf">VO Française</option>
										<option value="manual">Traduction Humaine</option>
										<option value="semi-auto">Traduction Semi-Automatique</option>
										<option value="auto">Traduction Automatique</option>
										<option value="to_tested">À tester</option>
										<option value="hs">Lien Trad HS</option>
									</select>
									<p class="mt-1 text-xs text-base-content/60">
										Utilisez « Lien Trad HS » si le lien ne fonctionne plus.
									</p>
								</div>

								<div class="form-control w-full">
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
							</div>
						</div>

						<div class="rounded-box border border-base-300 bg-base-200/30 p-4 md:p-5">
							<div class="mb-4">
								<h4 class="text-sm font-semibold text-base-content/80">Versions et lien</h4>
							</div>
							<div class="grid gap-4 md:grid-cols-2">
								<div class="form-control w-full">
									<label class="label" for="edit-version">
										<span class="label-text">Version de référence</span>
									</label>
									<input
										id="edit-version"
										type="text"
										placeholder="Ex: 1.2"
										class="input-bordered input w-full"
										bind:value={editingTranslation.version}
										disabled={editTranslationReferenceVersionLockedByAc}
									/>
									<p class="mt-1 text-xs text-base-content/60">
										Doit correspondre à la version source du jeu.
									</p>
									{#if editTranslationReferenceVersionLockedByAc}
										<p class="mt-1 text-xs text-base-content/60">
											Version verrouillée tant que l’auto-check traduction est actif.
										</p>
									{/if}
								</div>

								<div class="form-control w-full">
									<label class="label" for="edit-tversion">
										<span class="label-text">Version de traduction</span>
									</label>
									<input
										id="edit-tversion"
										type="text"
										placeholder="Ex: 1.0"
										class="input-bordered input w-full"
										bind:value={editingTranslation.tversion}
										disabled={editTranslationLinkNotRequired || editTranslationVersionsLockedByAc}
										required
									/>
									<p class="mt-1 text-xs text-base-content/60">
										Indiquez la version réellement publiée de la traduction.
									</p>
									{#if editTranslationVersionsLockedByAc}
										<p class="mt-1 text-xs text-base-content/60">
											Pour une traduction intégrée, la version reste « Intégrée » et la version de
											référence suit automatiquement la version du jeu.
										</p>
									{/if}
								</div>

								<div class="form-control w-full md:col-span-2">
									<label class="label" for="edit-tlink">
										<span class="label-text">Lien de traduction</span>
									</label>
									<div class="join join-horizontal w-full">
										<input
											id="edit-tlink"
											type="url"
											placeholder="https://..."
											class="input-bordered input join-item min-w-0 flex-1"
											bind:value={editingTranslation.tlink}
											disabled={editTranslationLinkNotRequired}
											required={!editTranslationLinkNotRequired}
										/>
										<button
											type="button"
											class="btn join-item shrink-0 btn-outline"
											disabled={editTranslationLinkNotRequired || !editingTranslation.tlink?.trim()}
											aria-label="Ouvrir le lien dans un nouvel onglet"
											onclick={() => {
												const u = editingTranslation.tlink?.trim();
												if (u) window.open(u, '_blank', 'noopener,noreferrer');
											}}
										>
											Ouvrir
										</button>
									</div>
									<p class="mt-1 text-xs text-base-content/60">
										Laissez vide uniquement pour « Intégrée » ou « Pas de traduction ».
									</p>
								</div>
							</div>
						</div>
					</div>
				{/key}

				<div class="rounded-box border border-base-300 bg-base-200/30 p-4 md:p-5">
					<div class="mb-4">
						<h4 class="text-sm font-semibold text-base-content/80">Auto-check</h4>
					</div>
					<div class="form-control mb-4 w-full">
						<div
							class="rounded-box border border-base-300 bg-base-100/70 p-4 text-sm text-base-content/80"
						>
							{#if game.website !== 'f95z'}
								<p>
									L’auto-check traduction n’est prévu que pour les jeux <strong>F95Zone</strong>.
									Sur ce site, il reste désactivé.
								</p>
							{:else if game.gameAutoCheck === false}
								<p>
									L’<strong>auto-check du jeu</strong> est désactivé sur cette fiche. À
									l’enregistrement, l’auto-check de <strong>cette</strong> traduction sera donc mis
									à
									<strong>false</strong>
									(même si la ligne était marquée en auto-check auparavant).
								</p>
								{#if isAdmin}
									<p class="mt-2 text-base-content/70">
										Pour pouvoir l’activer ici : ouvrez <strong>Modifier le jeu</strong> (en haut de la
										page), puis cochez l’auto-check jeu pour ce thread F95.
									</p>
								{/if}
							{:else if canManuallyEditTranslationAc}
								<p>
									Vous pouvez activer l’auto-check sur cette ligne. S’il est actif, la version de
									référence suit le jeu ; pour une traduction <strong>intégrée</strong>, la Trad.
									Ver. reste « Intégrée ».
								</p>
							{:else}
								<p>L’auto-check de cette traduction n’est pas modifiable avec votre rôle.</p>
							{/if}
						</div>
					</div>

					{#if canShowTranslationAcCheckbox}
						<div class="form-control w-full">
							<label
								class="label cursor-pointer justify-start gap-3 rounded-box border border-base-300 bg-base-100/70 px-3 py-2 {!canManuallyEditTranslationAc
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
							<p class="mt-1 text-xs text-base-content/60">
								Activez cette option si cette ligne doit suivre automatiquement la version du jeu.
							</p>
							{#if !canManuallyEditTranslationAc && game.website === 'f95z' && game.gameAutoCheck === false}
								<p class="mt-1 text-xs text-base-content/60">
									Réactivez d’abord l’auto-check du jeu pour cocher cette case.
								</p>
							{/if}
						</div>
					{/if}
				</div>

				<div class="rounded-box border border-base-300 bg-base-200/30 p-4 md:p-5">
					<div class="mb-4">
						<h4 class="text-sm font-semibold text-base-content/80">Contributeurs</h4>
					</div>
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
								class="input-bordered input w-full"
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
				</div>

				{#if isAdmin}
					<div class="rounded-box border border-base-300 bg-base-200/30 p-4 md:p-5">
						<p class="text-sm text-base-content/80">
							Désactive l'envoi d'une notification sur Discord.
						</p>
						<label class="label cursor-pointer gap-2 p-0">
							<span class="label-text">Mode silencieux</span>
							<input
								type="checkbox"
								class="toggle toggle-primary toggle-sm"
								bind:checked={editTranslationSilentMode}
							/>
						</label>
					</div>
				{/if}
			</div>

			<div
				class="sticky right-0 bottom-0 left-0 modal-action mt-6 w-full border-t border-base-300 bg-base-100/95 p-4 pt-4 backdrop-blur"
			>
				<button class="btn btn-ghost" onclick={closeEditTranslationModal}>Annuler</button>
				<button class="btn btn-primary" onclick={editTranslation}>Modifier</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal de modification du jeu -->
{#if showEditGameModal}
	<div class="modal-open modal">
		<div class="modal-box max-h-[90vh] max-w-7xl p-0">
			<div class="p-8">
				<h3 class="text-lg font-bold">Modifier le jeu</h3>
				<p class="mt-1 text-sm text-base-content/70">
					Mettez à jour les métadonnées du jeu sans modifier la logique existante.
				</p>
			</div>

			<div class="space-y-5 overflow-y-auto px-8">
				<div class="rounded-box border border-base-300 bg-base-200/30 p-4 md:p-5">
					<div class="mb-4">
						<h4 class="text-sm font-semibold text-base-content/80">Informations principales</h4>
					</div>
					<div
						class="mb-4 rounded-box border border-base-300 bg-base-100/70 p-3 text-sm text-base-content/80"
					>
						<p>
							Le <strong>moteur</strong> (Ren’Py, Unity, etc.) est défini
							<strong>par ligne de traduction</strong>
							: modifiez une traduction ou ajoutez-en une pour le renseigner.
						</p>
					</div>
					<div class="grid gap-4 md:grid-cols-2">
						<div class="form-control w-full">
							<label class="label" for="edit-game-name">
								<span class="label-text">Nom du jeu</span>
							</label>
							<input
								id="edit-game-name"
								type="text"
								placeholder="Nom du jeu"
								class="input-bordered input w-full"
								bind:value={editingGame.name}
								required
							/>
						</div>
						<div class="form-control w-full">
							<label class="label" for="edit-game-website">
								<span class="label-text">Site web</span>
							</label>
							<input
								id="edit-game-website"
								type="text"
								placeholder="Ex: F95Zone"
								class="input-bordered input w-full"
								bind:value={editingGame.website}
								required
							/>
						</div>
						<div class="form-control w-full">
							<label class="label" for="edit-game-threadId">
								<span class="label-text">ID du thread</span>
							</label>
							<input
								id="edit-game-threadId"
								type="text"
								placeholder="Ex: 12345"
								class="input-bordered input w-full"
								bind:value={editingGame.threadId}
							/>
							<p class="mt-1 text-xs text-base-content/60">
								Conservez l’ID brut du thread F95 pour les liens et l’auto-check.
							</p>
						</div>
						<div class="form-control w-full">
							<label class="label" for="edit-game-gameVersion">
								<span class="label-text">Version du jeu</span>
							</label>
							<input
								id="edit-game-gameVersion"
								type="text"
								placeholder="Ex: 1.2.3 — build du jeu côté thread"
								class="input-bordered input w-full"
								bind:value={editingGame.gameVersion}
							/>
							<p class="mt-1 text-xs text-base-content/60">
								Cette valeur peut alimenter les traductions en auto-check.
							</p>
						</div>
					</div>
				</div>

				<div class="rounded-box border border-base-300 bg-base-200/30 p-4 md:p-5">
					<div class="mb-4">
						<h4 class="text-sm font-semibold text-base-content/80">Liens et contenu</h4>
					</div>
					<div class="grid gap-4 md:grid-cols-2">
						<div class="form-control w-full">
							<label class="label" for="edit-game-link">
								<span class="label-text">Lien du thread</span>
							</label>
							<div class="join w-full">
								<input
									id="edit-game-link"
									type="url"
									placeholder="https://..."
									class="input-bordered input join-item w-full"
									bind:value={editingGame.link}
								/>
								<a
									class="btn join-item btn-outline"
									href={editingGame.link || '#'}
									target="_blank"
									rel="noopener noreferrer"
									aria-disabled={!editingGame.link}
									tabindex={editingGame.link ? undefined : -1}
								>
									Ouvrir
								</a>
							</div>
						</div>
						<div class="form-control w-full">
							<label class="label" for="edit-game-image">
								<span class="label-text">URL de l'image</span>
							</label>
							<div class="relative">
								<input
									id="edit-game-image"
									type="url"
									placeholder="https://..."
									class="input-bordered input w-full"
									bind:value={editingGame.image}
									onfocus={() => (showEditGameImagePreview = true)}
									onblur={() => (showEditGameImagePreview = false)}
									required
								/>
								{#if showEditGameImagePreview && editingGame.image?.trim()}
									<div
										class="absolute left-0 z-30 mt-2 w-full rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
									>
										<img
											src={editingGame.image}
											alt="Aperçu du visuel du jeu"
											class="max-h-56 w-full rounded-box object-cover"
										/>
									</div>
								{/if}
							</div>
						</div>
						<div class="form-control w-full">
							<label class="label" for="edit-game-tags">
								<span class="label-text">Tags</span>
							</label>
							<textarea
								id="edit-game-tags"
								placeholder="Ex: 3D, Adventure, Romance"
								class="textarea-bordered textarea min-h-28 w-full"
								bind:value={editingGame.tags}
							></textarea>
						</div>
						<div class="form-control w-full">
							<label class="label" for="edit-game-description">
								<span class="label-text">Description</span>
							</label>
							<textarea
								id="edit-game-description"
								placeholder="Description du jeu"
								class="textarea-bordered textarea min-h-28 w-full"
								bind:value={editingGame.description}
							></textarea>
						</div>
					</div>
				</div>

				{#if isAdmin}
					<div class="rounded-box border border-base-300 bg-base-200/30 p-4 md:p-5">
						<div class="mb-4">
							<h4 class="text-sm font-semibold text-base-content/80">Paramètres avancés</h4>
						</div>
						<div
							class="rounded-box border border-base-300 bg-base-100/70 p-3 text-sm text-base-content/80"
						>
							{#if editGameAutoCheckAllowed}
								<p>
									Si l’<strong>auto-check jeu</strong> est désactivé, aucune traduction ne pourra avoir
									l’auto-check. S’il est activé, ce n’est pas obligatoire sur chaque ligne : vous choisissez
									traduction par traduction.
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
							class="label mt-3 cursor-pointer rounded-box border border-base-300 bg-base-100/70 px-3 py-2 {!editGameAutoCheckAllowed
								? 'opacity-70'
								: ''}"
							for="edit-game-autocheck"
						>
							<input
								id="edit-game-autocheck"
								type="checkbox"
								class="toggle bg-base-200 toggle-sm"
								bind:checked={editingGame.gameAutoCheck}
								disabled={!editGameAutoCheckAllowed}
							/>
							<span class="label-text"
								>Auto-check jeu (autorise l’auto-check sur les traductions)</span
							>
						</label>
						<p class="mt-1 text-xs text-base-content/60">
							À activer seulement si vous souhaitez un suivi automatique des versions côté
							traductions.
						</p>
						{#if !editGameAutoCheckAllowed}
							<p class="mt-1 text-xs text-base-content/60">
								Choisissez le site F95Zone ci-dessus pour activer cette option.
							</p>
						{/if}
					</div>
				{/if}
			</div>

			<div
				class="sticky right-0 bottom-0 left-0 modal-action mt-6 w-full border-t border-base-300 bg-base-100/95 p-4 pt-4 backdrop-blur"
			>
				<button class="btn btn-ghost" onclick={closeEditGameModal}>Annuler</button>
				<button class="btn btn-primary" onclick={editGame}>Modifier</button>
			</div>
		</div>
	</div>
{/if}

{#if showGameImagePopup}
	<div class="modal-open modal" role="dialog" aria-modal="true" aria-label="Aperçu image du jeu">
		<div class="modal-box max-h-[90vh] max-w-5xl p-2 sm:p-4">
			<img
				src={gameCoverSrc}
				alt={game.name}
				class="mx-auto max-h-[80vh] w-auto max-w-full rounded-lg object-contain"
				referrerpolicy="no-referrer"
			/>
			<div class="modal-action mt-3">
				<button class="btn btn-ghost" onclick={() => (showGameImagePopup = false)}>Fermer</button>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button onclick={() => (showGameImagePopup = false)}>close</button>
		</form>
	</div>
{/if}

<!-- Modal de confirmation de suppression de traduction -->
{#if translationToDelete}
	<div class="modal-open modal">
		<div class="modal-box max-h-[90vh] max-w-4xl p-0">
			<div class="p-8">
				<h3 class="mb-4 text-lg font-bold">Confirmer la suppression</h3>
				<p class="mb-6">Êtes-vous sûr de vouloir supprimer cette traduction ?</p>
			</div>

			<div class="space-y-5 overflow-y-auto px-8">
				<div class="rounded-box border border-base-300 bg-base-200/30 p-4 md:p-5">
					<p><strong>Version traduction:</strong> {translationToDelete.tversion}</p>
					<p><strong>Statut:</strong> {getStatusText(translationToDelete.status)}</p>
				</div>
				<div class="rounded-box border border-base-300 bg-base-200/30 p-4 md:p-5">
					<label class="label" for="translation-delete-reason">
						<span class="label-text"
							>Raison de la suppression <span class="text-error">*</span></span
						>
					</label>
					<textarea
						id="translation-delete-reason"
						class="textarea-bordered textarea min-h-24 w-full"
						placeholder="Expliquez pourquoi cette traduction doit être retirée…"
						bind:value={translationDeleteReason}
					></textarea>
				</div>
			</div>
			<div
				class="sticky bottom-0 modal-action mt-6 border-t border-base-300 bg-base-100/95 p-4 pt-4 backdrop-blur"
			>
				<button class="btn btn-ghost" onclick={cancelDeleteTranslation}>Annuler</button>
				<button class="btn btn-error" onclick={deleteTranslation}>Supprimer</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal de confirmation de suppression de jeu -->
{#if gameToDelete}
	<div class="modal-open modal">
		<div class="modal-box max-h-[90vh] max-w-4xl p-0">
			<div class="p-8">
				<h3 class="mb-4 text-lg font-bold">Confirmer la suppression</h3>
				<p class="mb-6">Êtes-vous sûr de vouloir supprimer ce jeu ?</p>
			</div>

			<div class="space-y-5 overflow-y-auto px-8">
				<div class="mb-6 rounded-lg bg-base-200 p-4">
					<p><strong>Nom:</strong> {game.name}</p>
					<p class="mt-2 text-error">
						<strong>Attention:</strong> Cette action supprimera également toutes les traductions associées
						à ce jeu.
					</p>
				</div>
				<div class="form-control mb-6 w-full">
					<label class="label" for="game-delete-reason">
						<span class="label-text"
							>Raison de la suppression <span class="text-error">*</span></span
						>
					</label>
					<textarea
						id="game-delete-reason"
						class="textarea-bordered textarea min-h-24 w-full"
						placeholder="Expliquez pourquoi ce jeu doit être retiré…"
						bind:value={gameDeleteReason}
					></textarea>
				</div>
			</div>

			<div
				class="sticky right-0 bottom-0 left-0 modal-action mt-6 w-full border-t border-base-300 bg-base-100/95 p-4 pt-4 backdrop-blur"
			>
				<button class="btn btn-ghost" onclick={cancelDeleteGame}>Annuler</button>
				<button class="btn btn-error" onclick={deleteGame}>Supprimer</button>
			</div>
		</div>
	</div>
{/if}
