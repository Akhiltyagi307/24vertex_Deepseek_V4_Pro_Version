import { describe, expect, it } from "vitest";

/** Mirrors `adminRefundTestCredit` synthetic id (pure, no DB). */
function syntheticRefundEventId(testId: string, idempotencyKey: string) {
	return `admin:refund_credit:${testId}:${idempotencyKey}`.slice(0, 120);
}

describe("admin refund synthetic razorpay_event_id", () => {
	it("is stable for the same inputs", () => {
		const a = syntheticRefundEventId("550e8400-e29b-41d4-a716-446655440000", "key-1");
		const b = syntheticRefundEventId("550e8400-e29b-41d4-a716-446655440000", "key-1");
		expect(a).toBe(b);
	});

	it("differs when idempotency key differs", () => {
		const a = syntheticRefundEventId("550e8400-e29b-41d4-a716-446655440000", "k1");
		const b = syntheticRefundEventId("550e8400-e29b-41d4-a716-446655440000", "k2");
		expect(a).not.toBe(b);
	});

	it("truncates to 120 chars", () => {
		const longKey = "x".repeat(200);
		expect(syntheticRefundEventId("550e8400-e29b-41d4-a716-446655440000", longKey).length).toBeLessThanOrEqual(120);
	});
});
