/** En-têtes CORS pour `/api/extension-api` (clé API / session + Origin extension ou superadmin). */
export const extensionApiCorsHeaders: Record<string, string> = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key'
};
