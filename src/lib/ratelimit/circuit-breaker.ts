import "server-only";
import * as Sentry from "@sentry/nextjs";

/**
 * Per-process circuit breaker around rl_consume calls. If the rate-limit DB has
 * been flaky in the recent rolling window, trip open and fail-open (allow + log)
 * rather than fail-closed (deny everyone). Genuine users keep working; ops gets
 * a Sentry breadcrumb.
 */

const WINDOW_MS = 10_000;
const ERROR_THRESHOLD = 0.05; // 5%
const MIN_SAMPLES = 10;
const COOLDOWN_MS = 5_000;

interface Sample {
	ts: number;
	ok: boolean;
}

const globalForCb = globalThis as unknown as {
	__eduAiRlSamples?: Sample[];
	__eduAiRlOpenedAt?: { value: number };
};

const samples: Sample[] = globalForCb.__eduAiRlSamples ?? [];
if (!globalForCb.__eduAiRlSamples) globalForCb.__eduAiRlSamples = samples;

const openedAt = globalForCb.__eduAiRlOpenedAt ?? { value: 0 };
if (!globalForCb.__eduAiRlOpenedAt) globalForCb.__eduAiRlOpenedAt = openedAt;

function prune() {
	const cutoff = Date.now() - WINDOW_MS;
	while (samples.length > 0 && samples[0]!.ts < cutoff) samples.shift();
}

export function recordSuccess(): void {
	prune();
	samples.push({ ts: Date.now(), ok: true });
}

export function recordFailure(err: unknown): void {
	prune();
	samples.push({ ts: Date.now(), ok: false });
	Sentry.captureException(err, { tags: { component: "ratelimit", phase: "consume" } });

	if (samples.length >= MIN_SAMPLES) {
		const failures = samples.filter((s) => !s.ok).length;
		if (failures / samples.length > ERROR_THRESHOLD) {
			if (openedAt.value === 0) {
				Sentry.captureMessage("ratelimit.circuit_open", { level: "warning" });
			}
			openedAt.value = Date.now();
		}
	}
}

export function isCircuitOpen(): boolean {
	if (openedAt.value === 0) return false;
	if (Date.now() - openedAt.value > COOLDOWN_MS) {
		openedAt.value = 0;
		samples.length = 0;
		return false;
	}
	return true;
}

/** Test-only — reset state. */
export function __resetCircuitForTest(): void {
	samples.length = 0;
	openedAt.value = 0;
}
