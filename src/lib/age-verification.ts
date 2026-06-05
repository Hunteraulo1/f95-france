export const AGE_VERIFICATION_STORAGE_KEY = 'f95-france-age-verified';
export const AGE_VERIFICATION_COOKIE = AGE_VERIFICATION_STORAGE_KEY;
/** 1 an — aligné sur une confirmation d'âge persistante côté navigateur. */
export const AGE_VERIFICATION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isAgeVerified(): boolean {
	if (typeof localStorage === 'undefined') return false;
	return localStorage.getItem(AGE_VERIFICATION_STORAGE_KEY) === 'true';
}

export function setAgeVerified(): void {
	localStorage.setItem(AGE_VERIFICATION_STORAGE_KEY, 'true');
	document.cookie = `${AGE_VERIFICATION_COOKIE}=1; path=/; max-age=${AGE_VERIFICATION_COOKIE_MAX_AGE}; SameSite=Lax`;
}
