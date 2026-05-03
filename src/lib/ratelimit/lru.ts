import "server-only";

/**
 * Per-process LRU of recently-denied keys. A flood from one user hits the DB once
 * per TTL; the rest are served from memory. Cache only stores DENY verdicts —
 * never grants — so it cannot drift into incorrectly allowing requests.
 */

const TTL_MS = 1_500;
const MAX_ENTRIES = 1_000;

const globalForLru = globalThis as unknown as {
	__eduAiRlDenials?: Map<string, number>;
};

const denials: Map<string, number> = globalForLru.__eduAiRlDenials ?? new Map();
if (!globalForLru.__eduAiRlDenials) {
	globalForLru.__eduAiRlDenials = denials;
}

function evict() {
	if (denials.size <= MAX_ENTRIES) return;
	const overflow = denials.size - MAX_ENTRIES;
	let i = 0;
	for (const k of denials.keys()) {
		if (i++ >= overflow) break;
		denials.delete(k);
	}
}

export function recordDeny(key: string): void {
	denials.delete(key);
	denials.set(key, Date.now() + TTL_MS);
	evict();
}

export function isCachedDenied(key: string): boolean {
	const exp = denials.get(key);
	if (exp === undefined) return false;
	if (exp < Date.now()) {
		denials.delete(key);
		return false;
	}
	return true;
}

/** Test-only — clear all cached denials. */
export function __resetDenialsForTest(): void {
	denials.clear();
}
