<script lang="ts">
	import type { AddTranslatorMode } from '$lib/components/dashboard/add-translator-mode';
	import AddTranslationModal from '$lib/components/dashboard/game/AddTranslationModal.svelte';
	import DeleteGameModal from '$lib/components/dashboard/game/DeleteGameModal.svelte';
	import DeleteTranslationModal from '$lib/components/dashboard/game/DeleteTranslationModal.svelte';
	import EditGameModal from '$lib/components/dashboard/game/EditGameModal.svelte';
	import EditTranslationModal from '$lib/components/dashboard/game/EditTranslationModal.svelte';
	import GameImagePreviewModal from '$lib/components/dashboard/game/GameImagePreviewModal.svelte';
	import GameUpdateHistoryPanel from '$lib/components/dashboard/game/GameUpdateHistoryPanel.svelte';
	import { hasPermission } from '$lib/permissions/client';
	import type { ScrapedThreadGame } from '$lib/scrape/types';
	import { newToast } from '$lib/stores';
	import {
		isF95CheckerVersionAligned,
		normalizeCheckerVersion
	} from '$lib/utils/f95-checker-alignment';
	import { getGameEngineHexColor, getGameEngineLabel } from '$lib/utils/game-engine-colors';
	import {
		gameImageRequiredForEdit,
		normalizeGameImageForStorage
	} from '$lib/utils/game-form-validation';
	import { resolveGameImageSrc } from '$lib/utils/game-image-url';
	import {
		getTranslationProgressLabel,
		getTranslationTypeLabel
	} from '$lib/utils/game-translation-labels';
	import { validateGameLinkFields, validateTranslationLinkField } from '$lib/utils/link-validation';
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
	const canReviewSubmissions = $derived(
		data.canReviewSubmissions === true || $hasPermission('submissions.review')
	);
	const canShowInternalIds = $derived(
		data.canShowInternalIds === true || $hasPermission('content.view_ids')
	);
	const canViewUpdateHistory = $derived(
		data.canViewUpdateHistory === true || $hasPermission('games.view_history')
	);
	const canRevertUpdateHistory = $derived(data.canRevertUpdateHistory === true);
	const hasGamesManage = $derived($hasPermission('games.manage'));

	type FormTranslator = (typeof data.translators)[number];
	let extraTranslators = $state<FormTranslator[]>([]);
	let pendingNewTranslators = $state<string[]>([]);

	const addContributorMode = $derived(
		(data.addContributorMode ?? false) as AddTranslatorMode | false
	);
	const usesContributorSubmission = $derived(addContributorMode === 'submission');
	const canManageGameAutoCheck = $derived(
		data.canManageGameAutoCheck === true || $hasPermission('games.auto_check')
	);
	const canUseSilentMode = $derived(
		data.canUseSilentMode === true || $hasPermission('games.silent_mode')
	);
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
	/** Actualisation manuelle depuis le thread : F95Zone + auto-check jeu activé */
	const refreshManualBlocked = $derived(game.website !== 'f95z' || game.gameAutoCheck === false);
	const refreshManualBlockedReason = $derived(
		game.website !== 'f95z'
			? "L'actualisation manuelle n'est disponible que pour les jeux F95Zone."
			: game.gameAutoCheck === false
				? "L'actualisation manuelle nécessite l'auto-check jeu activé."
				: undefined
	);

	/**
	 * Peut activer l’auto-check sur une traduction : F95 + auto-check jeu.
	 * Si `ac` est true, l’auto-check jeu doit être actif ; l’inverse n’est pas vrai (traductions peuvent rester sans `ac`).
	 */
	const translationAcUiAllowed = $derived(game.website === 'f95z' && game.gameAutoCheck !== false);
	const canManuallyEditTranslationAc = $derived(
		canManageGameAutoCheck && game.gameAutoCheck === true
	);
	/** Droits auto-check : afficher la case AC sur une fiche F95 (désactivée si l’auto-check jeu est off). */
	const canShowTranslationAcCheckbox = $derived(canManageGameAutoCheck && game.website === 'f95z');

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
		descriptionFr: '',
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
		const defaultTranslatorInput = hasGamesManage ? '' : getCurrentUserDefaultTranslatorInput();
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
			if (newTranslation.tlink) newTranslation.tlink = '';
		}
		if (newTranslation.tname === 'integrated') {
			if (newTranslation.tversion !== 'Intégrée') newTranslation.tversion = 'Intégrée';
		} else if (newTranslation.tname === 'no_translation') {
			if (newTranslation.ttype !== 'hs') newTranslation.ttype = 'hs';
			if (newTranslation.tversion) newTranslation.tversion = '';
		} else if (newTranslation.tversion === 'Intégrée') {
			newTranslation.tversion = '';
		}
	});

	$effect(() => {
		if (!translationAcUiAllowed) {
			if (newTranslation.ac) newTranslation.ac = false;
			if (editingTranslation.ac) editingTranslation.ac = false;
		}
	});

	/** Même logique que l’ajout : lien vide si intégrée / pas de traduction ; type hs si pas de traduction ; intégrée → tversion */
	$effect(() => {
		if (!showEditTranslationModal) return;
		if (
			editingTranslation.tname === 'integrated' ||
			editingTranslation.tname === 'no_translation'
		) {
			if (editingTranslation.tlink) editingTranslation.tlink = '';
		}
		if (editingTranslation.tname === 'integrated') {
			if (editingTranslation.tversion !== 'Intégrée') editingTranslation.tversion = 'Intégrée';
		} else if (editingTranslation.tname === 'no_translation') {
			if (editingTranslation.ttype !== 'hs') editingTranslation.ttype = 'hs';
			if (editingTranslation.tversion) editingTranslation.tversion = '';
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
			if (editingTranslation.version !== gv) editingTranslation.version = gv;
			if (editingTranslation.tversion !== 'Intégrée') editingTranslation.tversion = 'Intégrée';
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

		if (game.gameAutoCheck === false) {
			newToast({
				alertType: 'warning',
				message: "L'actualisation manuelle nécessite l'auto-check jeu activé."
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

			const checkerVersion = normalizeCheckerVersion(data.version);
			const checkerVersionUnknown = checkerVersion === null;
			const acTranslationRows = translations.map((t) => ({
				ac: t.ac,
				version: t.version
			}));
			const wasAligned =
				checkerVersion !== null &&
				isF95CheckerVersionAligned(checkerVersion, game.gameVersion, acTranslationRows);

			const gameUpdateRes = await fetch(`/dashboard/game/${game.id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					name: game.name,
					description: data.description ?? game.description ?? '',
					type: data.gameType ?? (translations[0]?.gameType as string | undefined) ?? 'other',
					website: game.website,
					threadId: game.threadId ? String(game.threadId) : '',
					tags: data.tags ?? game.tags ?? '',
					link: game.link ?? '',
					image: data.image ?? game.image ?? '',
					gameAutoCheck: game.gameAutoCheck ?? true,
					gameVersion: checkerVersionUnknown ? (data.version ?? 'Unknown') : checkerVersion,
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
				message: checkerVersionUnknown
					? 'Version inconnue (Unknown) : auto-check désactivé, fiche rafraîchie'
					: wasAligned
						? 'Version à jour — fiche rafraîchie (auto-check conservé)'
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

		const tlinkError = validateTranslationLinkField({
			tlink: linkNotRequired ? '' : newTranslation.tlink,
			tname: newTranslation.tname
		});
		if (tlinkError) {
			newToast({ alertType: 'error', message: tlinkError });
			return;
		}

		try {
			let translatorIdValue: string | null = null;
			let proofreaderIdValue: string | null = null;

			if (usesContributorSubmission) {
				translatorIdValue = newTranslation.translatorId?.trim() || null;
				proofreaderIdValue = newTranslation.proofreaderId?.trim() || null;
			} else {
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
			}

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
				silentMode: canUseSilentMode ? addTranslationSilentMode : false,
				...(usesContributorSubmission && pendingNewTranslators.length > 0
					? { pendingNewTranslators }
					: {})
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
				pendingNewTranslators = [];
				closeAddTranslationModal();
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

		const editTlinkError = validateTranslationLinkField({
			tlink: linkNotRequired ? '' : editingTranslation.tlink,
			tname: editingTranslation.tname
		});
		if (editTlinkError) {
			newToast({ alertType: 'error', message: editTlinkError });
			return;
		}

		try {
			let translatorIdValue: string | null = null;
			let proofreaderIdValue: string | null = null;

			if (usesContributorSubmission) {
				translatorIdValue = editingTranslation.translatorId?.trim() || null;
				proofreaderIdValue = editingTranslation.proofreaderId?.trim() || null;
			} else {
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
				silentMode: canUseSilentMode ? editTranslationSilentMode : false,
				...(usesContributorSubmission && pendingNewTranslators.length > 0
					? { pendingNewTranslators }
					: {})
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

	const editGameAutoCheckAllowed = $derived(game.website === 'f95z');
	const requireEditGameImage = $derived(
		gameImageRequiredForEdit(game.website, editingGame.website, {
			gameAutoCheck: game.website === 'f95z' ? editingGame.gameAutoCheck : false
		})
	);

	$effect(() => {
		if (showEditGameModal && !editGameAutoCheckAllowed) {
			editingGame.gameAutoCheck = false;
		}
	});

	const openEditGameModal = () => {
		showEditGameImagePreview = false;
		const isF95 = game.website === 'f95z';
		const gameAutoCheck = isF95 ? (game.gameAutoCheck ?? true) : (game.gameAutoCheck ?? false);
		editingGame = {
			name: game.name,
			description: game.description || '',
			descriptionFr: game.descriptionFr || '',
			website: game.website,
			threadId: game.threadId ? String(game.threadId) : '',
			tags: game.tags || '',
			link: game.link || '',
			image: normalizeGameImageForStorage(game.website, game.image, { gameAutoCheck }),
			gameAutoCheck,
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
			descriptionFr: '',
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
		const editGameAutoCheck = game.website === 'f95z' ? editingGame.gameAutoCheck : false;
		const storedImage = normalizeGameImageForStorage(game.website, editingGame.image, {
			gameAutoCheck: editGameAutoCheck
		});
		const { descriptionFr, ...editingGamePayload } = editingGame;
		const gameLinkError = validateGameLinkFields({
			link: editingGame.link,
			image: storedImage,
			requireLink: true,
			requireImage: requireEditGameImage
		});
		if (gameLinkError) {
			newToast({ alertType: 'error', message: gameLinkError });
			return;
		}

		try {
			const response = await fetch(`/dashboard/game/${game.id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					...editingGamePayload,
					description_fr: descriptionFr,
					website: game.website,
					image: storedImage,
					gameAutoCheck: Boolean(editGameAutoCheck)
				})
			});

			if (response.ok) {
				// Fermer le modal
				closeEditGameModal();
				// Recharger la page pour voir les modifications
				window.location.reload();
			} else {
				const errorData = await response.json();
				newToast({
					alertType: 'error',
					message: `Erreur lors de la modification du jeu: ${errorData.error || 'Erreur inconnue'}`
				});
			}
		} catch (error) {
			console.error('Erreur lors de la modification du jeu:', error);
			newToast({
				alertType: 'error',
				message: 'Erreur de connexion lors de la modification du jeu'
			});
		}
	};
</script>

<svelte:head>
	<title>{game.name} - F95 France</title>
	<meta
		name="description"
		content={game.descriptionFr || game.description || `Détails du jeu ${game.name}`}
	/>
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
											<a
												class="font-semibold link link-hover"
												href={`/dashboard/profile/${sub.username}`}>{sub.username}</a
											>
										{/if}
										{#if sub.openedByUsername}
											· <span class="text-base-content/70">ouverte par</span>
											<a
												class="font-semibold link link-hover"
												href={`/dashboard/profile/${sub.openedByUsername}`}
												>{sub.openedByUsername}</a
											>
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
						{#if canReviewSubmissions}
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
						{:else}
							<div
								class="flex h-64 w-48 items-center justify-center rounded-lg bg-base-200 px-3 text-center text-xs text-base-content/60"
								title="Aucune vignette disponible"
							>
								Aucune vignette disponible
							</div>
						{/if}
						<button class="btn btn-sm btn-primary" onclick={openEditGameModal}>
							<SquarePen size={16} />
							Modifier le jeu
						</button>
						{#if canManageGameAutoCheck}
							<button
								class="btn btn-sm btn-secondary"
								onclick={refreshGame}
								disabled={refreshManualBlocked}
								title={refreshManualBlockedReason}
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

						{#if game.descriptionFr || game.description}
							{#if game.descriptionFr}
								<p class="mb-4 leading-relaxed text-base-content/80">{game.descriptionFr}</p>
							{/if}
							{#if game.description && game.description !== game.descriptionFr}
								<details class="mb-4 text-sm text-base-content/70">
									<summary class="cursor-pointer font-medium">Description originale</summary>
									<p class="mt-2 leading-relaxed whitespace-pre-wrap">{game.description}</p>
								</details>
							{/if}
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
							{#if canManageGameAutoCheck && game.website === 'f95z'}
								<span
									class="badge badge-lg {game.gameAutoCheck !== false
										? 'badge-success'
										: 'badge-ghost'}"
									title="Suivi automatique des versions F95 sur ce jeu"
								>
									Auto-check jeu : {game.gameAutoCheck !== false ? 'activé' : 'désactivé'}
								</span>
							{/if}
							{#if canShowInternalIds}
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
												{getTranslationProgressLabel(translation.status)}
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
												{getTranslationTypeLabel(translation.ttype)}
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

		{#if canViewUpdateHistory}
			<GameUpdateHistoryPanel
				gameId={game.id}
				canRevert={canRevertUpdateHistory}
				history={data.updateHistoryPage?.entries ?? []}
				historyPage={data.updateHistoryPage?.page ?? 1}
				historyTotalPages={data.updateHistoryPage?.totalPages ?? 1}
				historyTotalCount={data.updateHistoryPage?.totalCount ?? 0}
				translators={data.translators}
				translations={translations.map((t) => ({
					id: t.id,
					translationName: t.translationName
				}))}
			/>
		{/if}
	</div>
</div>

<AddTranslationModal
	open={showAddTranslationModal}
	game={{
		gameVersion: game.gameVersion,
		website: game.website,
		gameAutoCheck: game.gameAutoCheck
	}}
	translators={data.translators}
	bind:newTranslation
	bind:addTranslationSilentMode
	bind:extraTranslators
	bind:pendingNewTranslators
	{canManageGameAutoCheck}
	{canUseSilentMode}
	{translationAcUiAllowed}
	{addContributorMode}
	{addTranslationAutoCheckPreview}
	{addTranslationTversionLocked}
	onClose={closeAddTranslationModal}
	onSubmit={addTranslation}
/>

<EditTranslationModal
	open={showEditTranslationModal}
	game={{
		website: game.website,
		gameAutoCheck: game.gameAutoCheck
	}}
	translators={data.translators}
	bind:editingTranslation
	bind:editTranslationSilentMode
	bind:extraTranslators
	bind:pendingNewTranslators
	{canShowInternalIds}
	{canManageGameAutoCheck}
	{canUseSilentMode}
	{canManuallyEditTranslationAc}
	{canShowTranslationAcCheckbox}
	{editTranslationLinkNotRequired}
	{editTranslationVersionsLockedByAc}
	{editTranslationReferenceVersionLockedByAc}
	{addContributorMode}
	onClose={closeEditTranslationModal}
	onSubmit={editTranslation}
/>

<EditGameModal
	open={showEditGameModal}
	gameWebsite={game.website}
	bind:editingGame
	bind:showImagePreview={showEditGameImagePreview}
	{canManageGameAutoCheck}
	{editGameAutoCheckAllowed}
	requireImage={requireEditGameImage}
	onClose={closeEditGameModal}
	onSubmit={editGame}
/>

<GameImagePreviewModal
	open={showGameImagePopup}
	imageSrc={gameCoverSrc}
	alt={game.name}
	onClose={() => (showGameImagePopup = false)}
/>

<DeleteTranslationModal
	translation={translationToDelete}
	bind:reason={translationDeleteReason}
	onClose={cancelDeleteTranslation}
	onConfirm={deleteTranslation}
/>

<DeleteGameModal
	open={gameToDelete}
	gameName={game.name}
	bind:reason={gameDeleteReason}
	onClose={cancelDeleteGame}
	onConfirm={deleteGame}
/>
