/** Libellé français pour un identifiant `gameType` en base. */
export function getGameEngineLabel(gt: string | null | undefined): string {
	const key = (gt ?? '').trim().toLowerCase();
	switch (key) {
		case 'renpy':
			return "Ren'Py";
		case 'rpgm':
			return 'RPGM';
		case 'unity':
			return 'Unity';
		case 'unreal':
			return 'Unreal';
		case 'flash':
			return 'Flash';
		case 'html':
			return 'HTML';
		case 'qsp':
			return 'QSP';
		case 'other':
			return 'Autre';
		default:
			return typeof gt === 'string' && gt.trim() ? gt : '—';
	}
}

/** Couleurs d’affichage par identifiant `gameType` (schéma : renpy, rpgm, …). */
export function getGameEngineHexColor(gameType: string | null | undefined): string {
	const key = (gameType ?? '').trim().toLowerCase();
	switch (key) {
		case 'renpy':
			return '#b069e8';
		case 'rpgm':
			return '#349ff4';
		case 'unity':
			return '#fe5901';
		case 'unreal':
			return '#0f4fb4';
		case 'html':
      return '#72ae3d';
		case 'qsp':
			return '#d74040';
		case 'other':
			return '#72ae3d';
		default:
			return '#6b6b6b';
	}
}
