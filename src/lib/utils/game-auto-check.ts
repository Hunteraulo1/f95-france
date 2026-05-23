/** L’auto-check jeu (et traduction) n’est autorisé que pour F95Zone. */
export function gameAutoCheckEnabledForWebsite(website: string | null | undefined): boolean {
	return (website ?? '').trim() === 'f95z';
}
