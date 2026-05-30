/**
 * Behavioral route-handler tests for `POST /api/billing/webhook` (H-4).
 *
 * Replaces the previous "test" (a 14-line readFileSync source-grep that never
 * executed the handler). These actually run POST and assert the branching that
 * matters for the payment path: signature gate, dedup, dispatch, and the
 * error/replay handling — none of which had any executing coverage.
 *
 * `verifyWebhookSignature` and `processRazorpayWebhookPayload` are mocked so we
 * exercise the route's own logic; the signature algorithm itself is covered by
 * src/lib/billing/__tests__/razorpay-signature.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InvalidStateTransitionError } from "@/lib/billing/subscription-state-machine";
import { makeMockSupabase, type MockSupabaseClient } from "../../factories/supabase";

const { sigMock, processorSpy, adminHolder } = vi.hoisted(() => ({
	sigMock: { current: (_raw: string, _sig: string | null): boolean => true },
	processorSpy: vi.fn(async (_admin: unknown, _body: unknown): Promise<void> => {}),
	adminHolder: { current: null as unknown },
}));

vi.mock("@/lib/billing/razorpay", () => ({
	verifyWebhookSignature: (raw: string, sig: string | null) => sigMock.current(raw, sig),
}));
vi.mock("@/lib/billing/razorpay-webhook-processor", () => ({
	processRazorpayWebhookPayload: (admin: unknown, body: unknown) => processorSpy(admin, body),
}));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => adminHolder.current }));
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn(), captureException: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/server/log-supabase-error", () => ({ logServerError: vi.fn(), logSupabaseError: vi.fn() }));

import { POST } from "@/app/api/billing/webhook/route";

const VALID_BODY = JSON.stringify({ id: "evt_123", event: "subscription.charged", payload: {} });

function makeRequest(rawBody: string, sig: string | null = "sig_header"): Request {
	const headers: Record<string, string> = { "content-type": "application/json" };
	if (sig !== null) headers["x-razorpay-signature"] = sig;
	return new Request("http://localhost/api/billing/webhook", { method: "POST", body: rawBody, headers });
}

/** New-event default: the dedup upsert returns a fresh row id. */
function freshEventAdmin(): MockSupabaseClient {
	return makeMockSupabase({ tables: { billing_events: { data: { id: "evt-row-1" }, error: null } } });
}

describe("POST /api/billing/webhook", () => {
	beforeEach(() => {
		sigMock.current = () => true;
		processorSpy.mockReset();
		processorSpy.mockResolvedValue(undefined);
		adminHolder.current = freshEventAdmin();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("rejects a bad signature with 400 and never dispatches", async () => {
		sigMock.current = () => false;
		const res = await POST(makeRequest(VALID_BODY));
		expect(res.status).toBe(400);
		expect(processorSpy).not.toHaveBeenCalled();
	});

	it("processes a new, validly-signed event with 200 and dispatches once", async () => {
		const res = await POST(makeRequest(VALID_BODY));
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.ok).toBe(true);
		expect(processorSpy).toHaveBeenCalledTimes(1);
	});

	it("deduplicates a replayed event: 200 deduped, no dispatch", async () => {
		// upsert(ignoreDuplicates) + .maybeSingle() returns no row when the event
		// id already exists.
		adminHolder.current = makeMockSupabase({ tables: { billing_events: { data: null, error: null } } });
		const res = await POST(makeRequest(VALID_BODY));
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.deduped).toBe(true);
		expect(processorSpy).not.toHaveBeenCalled();
	});

	it("returns 400 on an unparseable body even when the signature passes", async () => {
		const res = await POST(makeRequest("{not valid json"));
		expect(res.status).toBe(400);
		expect(processorSpy).not.toHaveBeenCalled();
	});

	it("returns 500 if the dedup insert errors (does not dispatch)", async () => {
		adminHolder.current = makeMockSupabase({
			tables: { billing_events: { data: null, error: { message: "insert failed" } } },
		});
		const res = await POST(makeRequest(VALID_BODY));
		expect(res.status).toBe(500);
		expect(processorSpy).not.toHaveBeenCalled();
	});

	it("swallows an InvalidStateTransitionError replay as 200 (stops Razorpay retry storm)", async () => {
		processorSpy.mockRejectedValueOnce(new InvalidStateTransitionError("cancelled", "active", "sub_1"));
		const res = await POST(makeRequest(VALID_BODY));
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.skipped).toBe("invalid_state_transition");
	});

	it("returns 500 when the processor throws a generic error", async () => {
		processorSpy.mockRejectedValueOnce(new Error("kaboom"));
		const res = await POST(makeRequest(VALID_BODY));
		expect(res.status).toBe(500);
	});
});
