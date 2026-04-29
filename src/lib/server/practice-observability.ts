import "server-only";

/**
 * One JSON line per call — safe for log drains. Only include non-sensitive fields
 * (ids, timings, counts). Never attach prompts, answers, or model output.
 */
export function newPracticeCorrelationId(): string {
	return crypto.randomUUID();
}

function sanitizeForObs(value: unknown): unknown {
	if (value === undefined) return undefined;
	if (value === null) return null;
	const t = typeof value;
	if (t === "string" || t === "number" || t === "boolean") return value;
	if (Array.isArray(value)) {
		return value.map(sanitizeForObs).filter((x) => x !== undefined);
	}
	if (t === "object") {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			const s = sanitizeForObs(v);
			if (s !== undefined) out[k] = s;
		}
		return out;
	}
	return undefined;
}

export function logPracticeObs(fields: Record<string, unknown>): void {
	const payload = sanitizeForObs({
		kind: "practice_obs",
		ts: new Date().toISOString(),
		...fields,
	}) as Record<string, unknown>;
	console.info(JSON.stringify(payload));
}

/** Wall-clock ms between calls; first call returns ms since `start()`. */
export function createPhaseTimer(startedAt = Date.now()) {
	let last = startedAt;
	return () => {
		const now = Date.now();
		const delta = now - last;
		last = now;
		return delta;
	};
}
