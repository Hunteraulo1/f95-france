export const GAME_ENGINE_SELECT_VALUES = [
	'renpy',
	'rpgm',
	'unity',
	'unreal',
	'flash',
	'html',
	'qsp',
	'other'
] as const;

export function getTranslationProgressLabel(status: string): string {
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
}

export function getTranslationTypeLabel(ttype: string): string {
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
}
