import "server-only";

import * as Sentry from "@sentry/nextjs";

import type { AdminActionName } from "./audit-actions";

/**
 * D30: lightweight, low-cardinality metric emission for admin actions.
 *
 * The audit log captures the *fact* of every admin action; this helper adds
 * a counter signal that's friendly to dashboards / SLO charts without
 * inflating Sentry's event volume. Implementation: emit a tagged
 * `Sentry.captureMessage` at `info` level. The tag set is intentionally
 * narrow — `action`, `ok`, and an optional latency bucket — so Sentry can
 * group cheaply and "events per action per outcome" is one filter.
 *
 * Why not Sentry's metrics API: the metrics surface in this codebase isn't
 * standardized yet and the `captureMessage` path already runs through the
 * existing PII scrubber. If we later move to a dedicated metrics sink, this
 * helper is the single point of redirection.
 */

export interface AdminMetricInput {
	action: AdminActionName | string;
	ok: boolean;
	latencyMs?: number;
}

function latencyBucket(latencyMs: number | undefined): string | null {
	if (latencyMs == null || !Number.isFinite(latencyMs)) return null;
	if (latencyMs < 50) return "u50";
	if (latencyMs < 200) return "u200";
	if (latencyMs < 1000) return "u1s";
	if (latencyMs < 5000) return "u5s";
	return "gt5s";
}

export function recordAdminMetric(input: AdminMetricInput): void {
	try {
		Sentry.withScope((scope) => {
			scope.setTag("feature", "admin");
			scope.setTag("metric", "admin_action");
			scope.setTag("admin_action", String(input.action));
			scope.setTag("admin_action_ok", input.ok ? "1" : "0");
			const bucket = latencyBucket(input.latencyMs);
			if (bucket) scope.setTag("admin_latency_bucket", bucket);
			Sentry.captureMessage(`admin_metric:${input.action}`, {
				level: "info",
				fingerprint: ["admin_metric", String(input.action)],
			});
		});
	} catch {
		// Metrics emission is informational; never throw to the caller.
	}
}
