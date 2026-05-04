/** CORS pour réponses d’erreur d’accès API (clé manquante / invalide) et référence pour clients externes. */
export const apiPublicErrorCorsHeaders: Record<string, string> = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key'
};
