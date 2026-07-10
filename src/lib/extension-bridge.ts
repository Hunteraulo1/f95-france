/**
 * Protocole de communication `window.postMessage` entre le site et l’extension
 * navigateur, pour la liaison de compte en un clic.
 *
 * Le site (cette app) et le content script de l’extension partagent la même
 * `window` : on distingue donc les deux sens par le champ `channel` pour éviter
 * qu’un émetteur ne reçoive ses propres messages.
 *
 * Sécurité : l’échange réel du code (→ clé API) reste fait par le service worker
 * de l’extension via `POST /api/extension/link` (origine `*-extension://`). Le
 * code de liaison transitant ici est à usage unique et expire en quelques
 * minutes ; aucune clé API ne passe jamais par ce canal.
 */

/** Messages site → extension. */
export const BRIDGE_TO_EXTENSION = 'f95-france:to-extension';
/** Messages extension → site. */
export const BRIDGE_TO_SITE = 'f95-france:to-site';

export type SiteToExtensionMessage =
	| { channel: typeof BRIDGE_TO_EXTENSION; type: 'ping' }
	| { channel: typeof BRIDGE_TO_EXTENSION; type: 'link'; code: string };

export type ExtensionToSiteMessage =
	| { channel: typeof BRIDGE_TO_SITE; type: 'pong'; version?: string }
	| { channel: typeof BRIDGE_TO_SITE; type: 'linked'; ok: true }
	| { channel: typeof BRIDGE_TO_SITE; type: 'linked'; ok: false; error?: string };

/** Vrai si la valeur est un message valide émis par l’extension vers le site. */
export function isExtensionToSiteMessage(value: unknown): value is ExtensionToSiteMessage {
	if (!value || typeof value !== 'object') return false;
	const msg = value as { channel?: unknown; type?: unknown };
	if (msg.channel !== BRIDGE_TO_SITE) return false;
	return msg.type === 'pong' || msg.type === 'linked';
}
