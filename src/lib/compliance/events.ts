import "server-only";

import * as Sentry from "@sentry/nextjs";
import { sql } from "drizzle-orm";

import { db } from "@/db";

export type CompliancePhaseStatus = "started" | "ok" | "failed" | "skipped";

export interface ComplianceEventInput {
	requestId: string;
	phase: string;
	status: CompliancePhaseStatus;
	errorMessage?: string | null;
	payload?: Record<string, unknown> | null;
}

/**
 * Append a structured saga event to `compliance_request_events`.
 *
 * Best-effort: failures are reported to Sentry but never abort the calling
 * saga. The legacy `compliance_requests.notes` write (via `appendDsrNote`)
 * stays in place alongside this call as a compatibility shim until admin
 * UIs migrate to query the structured table.
 *
 * Why a fire-and-forget shape (cf. writeAdminAction's retry+ack):
 *   The events are an OBSERVABILITY ledger, not a compliance-mandated
 *   audit trail (admin_action_log is the latter). Erasure / export sagas
 *   already retry their primary writes; layering retry-on-event would
 *   double-stack timeouts on a slow DB. A Sentry capture is enough to
 *   surface a degraded events table to operators.
 */
export async function recordComplianceEvent(input: ComplianceEventInput): Promise<void> {
	try {
		await db.execute(sql`
			insert into public.compliance_request_events
				(request_id, phase, status, error_message, payload)
			values (
				${input.requestId},
				${input.phase},
				${input.status},
				${input.errorMessage ?? null},
				${input.payload ? JSON.stringify(input.payload) : null}::jsonb
			)
		`);
	} catch (e) {
		Sentry.captureException(e, {
			tags: { feature: "compliance", phase: "record_event" },
			extra: {
				request_id: input.requestId,
				saga_phase: input.phase,
				saga_status: input.status,
			},
		});
	}
}
