/** En-têtes CORS pour `/api/extension-api` (clé API / session + Origin extension ou superadmin). */
export const extensionApiCorsHeaders: Record<string, string> = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key'
};

/** En-têtes CORS pour la sync des filtres `/api/extension/saved-filters/*` (lecture + écriture). */
export const extensionSyncCorsHeaders: Record<string, string> = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key'
};

/** En-têtes CORS pour l’échange du code de liaison `/api/extension/link` (aucune clé requise). */
export const extensionLinkCorsHeaders: Record<string, string> = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type'
};
