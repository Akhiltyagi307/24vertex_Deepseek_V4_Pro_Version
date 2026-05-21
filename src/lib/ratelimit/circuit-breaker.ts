import "server-only";
import * as Sentry from "@sentry/nextjs";

/**
 * Per-process circuit breaker around rl_consume calls.
 *
 * Default policy is fail-OPEN: if the rate-limit DB is briefly flaky, allow
 * the request through and log to Sentry rather than 4xx legitimate users.
 * That trade-off is correct for a single transient incident.
 *
 * Hardening (audit P1): a sustained-flap pattern — circuit opens, recovers
 * for a moment, opens again, repeats — is no longer a "transient incident",
 * it's an attacker triggering DB errors specifically to bypass the rate
 * limit. After {@link FAIL_CLOSED_OPEN_COUNT} open transitions inside
 * {@link FAIL_CLOSED_WINDOW_MS}, the breaker switches to fail-CLOSED mode
 * for the remainder of that window: rlConsume returns `allowed=false` so
 * upstream callers can 503. The flap counter resets after a long stable
 * closed period or an explicit `__resetCircuitForTest`.
 *
 * Tunables can be overridden via env so an operator responding to a real
 * incident can widen the window without a deploy.
 */

const WINDOW_MS = 10_000;
const ERROR_THRESHOLD = 0.05; // 5%
const MIN_SAMPLES = 10;
const COOLDOWN_MS = 5_000;

function envInt(name: string, fallback: number): number {
	const raw = process.env[name];
	if (!raw) return fallback;
	const n = Number.parseInt(raw, 10);
	return Number.isFinite(n) && n > 0 ? n : fallback;
}

const FAIL_CLOSED_OPEN_COUNT = envInt("RATELIMIT_FAIL_CLOSED_OPEN_COUNT", 3);
const FAIL_CLOSED_WINDOW_MS = envInt("RATELIMIT_FAIL_CLOSED_WINDOW_MS", 5 * 60_000);

interface Sample {
	ts: number;
	ok: boolean;
}

interface OpenLog {
	/** Wall-clock times of recent transitions to "open". */
	transitions: number[];
}

const globalForCb = globalThis as unknown as {
	__vertex24RlSamples?: Sample[];
	__vertex24RlOpenedAt?: { value: number };
	__vertex24RlOpenLog?: OpenLog;
};

const samples: Sample[] = globalForCb.__vertex24RlSamples ?? [];
if (!globalForCb.__vertex24RlSamples) globalForCb.__vertex24RlSamples = samples;

const openedAt = globalForCb.__vertex24RlOpenedAt ?? { value: 0 };
if (!globalForCb.__vertex24RlOpenedAt) globalForCb.__vertex24RlOpenedAt = openedAt;

const openLog: OpenLog = globalForCb.__vertex24RlOpenLog ?? { transitions: [] };
if (!globalForCb.__vertex24RlOpenLog) globalForCb.__vertex24RlOpenLog = openLog;

function prune() {
	const cutoff = Date.now() - WINDOW_MS;
	while (samples.length > 0 && samples[0]!.ts < cutoff) samples.shift();
}

function pruneOpenLog() {
	const cutoff = Date.now() - FAIL_CLOSED_WINDOW_MS;
	while (openLog.transitions.length > 0 && openLog.transitions[0]! < cutoff) {
		openLog.transitions.shift();
	}
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
				// Edge transition closed → open. Record the timestamp so the
				// fail-closed escalator can spot a flap pattern.
				openLog.transitions.push(Date.now());
				pruneOpenLog();
				if (openLog.transitions.length >= FAIL_CLOSED_OPEN_COUNT) {
					Sentry.captureMessage("ratelimit.circuit_fail_closed", {
						level: "error",
						tags: { component: "ratelimit", phase: "fail_closed" },
						extra: {
							open_transitions: openLog.transitions.length,
							window_ms: FAIL_CLOSED_WINDOW_MS,
						},
					});
				} else {
					Sentry.captureMessage("ratelimit.circuit_open", { level: "warning" });
				}
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

/**
 * True when the breaker has flapped open repeatedly within the fail-closed
 * window. Callers (`rlConsume`) should treat this as "rate-limit
 * infrastructure is unavailable" and reject upstream rather than fail-open.
 *
 * The counter naturally decays: once the window passes with no new opens,
 * `pruneOpenLog` drops the entries and we return to normal fail-open.
 */
export function isCircuitFailClosedMode(): boolean {
	pruneOpenLog();
	return openLog.transitions.length >= FAIL_CLOSED_OPEN_COUNT;
}

/** Test-only — reset state. */
export function __resetCircuitForTest(): void {
	samples.length = 0;
	openedAt.value = 0;
	openLog.transitions.length = 0;
}
