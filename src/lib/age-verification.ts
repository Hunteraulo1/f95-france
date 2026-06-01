export const AGE_VERIFICATION_STORAGE_KEY = 'f95-france-age-verified';

export function isAgeVerified(): boolean {
	if (typeof localStorage === 'undefined') return false;
	return localStorage.getItem(AGE_VERIFICATION_STORAGE_KEY) === 'true';
}

export function setAgeVerified(): void {
	localStorage.setItem(AGE_VERIFICATION_STORAGE_KEY, 'true');
}
