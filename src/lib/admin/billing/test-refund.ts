import "server-only";

import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type AdminRefundTestCreditResult =
	| { ok: true; deduped: boolean }
	| { ok: false; code: "nothing_to_refund" | "rpc_error"; message: string };

/**
 * Refunds practice-test quota on the active usage period and logs `billing_events`
 * (`admin_refund_test_credit_event` RPC — idempotent via synthetic `razorpay_event_id`).
 */
export async function adminRefundTestCredit(input: {
	profileId: string;
	testId: string;
	amount?: number;
	reason: string;
	idempotencyKey: string;
}): Promise<AdminRefundTestCreditResult> {
	const amount = input.amount ?? 1;
	const syntheticId = `admin:refund_credit:${input.testId}:${input.idempotencyKey}`.slice(0, 120);
	const admin = createServiceRoleClient();

	const payload = {
		source: "admin_panel",
		action: "refund_test_credit",
		test_id: input.testId,
		profile_id: input.profileId,
		reason: input.reason,
	};

	const { data, error } = await admin.rpc("admin_refund_test_credit_event", {
		p_profile_id: input.profileId,
		p_amount: amount,
		p_synthetic_event_id: syntheticId,
		p_payload: payload,
	});

	if (error) {
		logSupabaseError("adminRefundTestCredit.admin_refund_test_credit_event", error, {
			testId: input.testId,
			profileId: input.profileId,
		});
		return { ok: false, code: "rpc_error", message: error.message };
	}

	const row = data as { ok?: boolean; deduped?: boolean; error?: string } | null;
	if (!row?.ok) {
		if (row?.error === "nothing_to_refund") {
			return { ok: false, code: "nothing_to_refund", message: "No usage to refund for this period." };
		}
		return { ok: false, code: "rpc_error", message: row?.error ?? "Refund failed." };
	}

	return { ok: true, deduped: Boolean(row.deduped) };
}
