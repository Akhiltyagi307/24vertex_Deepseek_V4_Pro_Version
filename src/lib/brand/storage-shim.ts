/**
 * Browser storage helpers: read new key, fall back to legacy, migrate on read.
 * Client-only — guard with typeof window !== "undefined" at call sites if needed.
 */

export function readWithLegacyStorageKey(newKey: string, legacyKey: string): string | null {
	if (typeof window === "undefined") return null;
	try {
		const next = localStorage.getItem(newKey);
		if (next != null) return next;
		const legacy = localStorage.getItem(legacyKey);
		if (legacy == null) return null;
		localStorage.setItem(newKey, legacy);
		localStorage.removeItem(legacyKey);
		return legacy;
	} catch {
		return null;
	}
}

export function writeStorageKey(key: string, value: string): void {
	if (typeof window === "undefined") return;
	try {
		localStorage.setItem(key, value);
	} catch {
		/* quota / private mode */
	}
}

export function removeStorageKey(key: string): void {
	if (typeof window === "undefined") return;
	try {
		localStorage.removeItem(key);
	} catch {
		/* ignore */
	}
}
