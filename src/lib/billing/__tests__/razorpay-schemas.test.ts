import { describe, expect, it } from "vitest";

import {
	RazorpayCustomerSchema,
	RazorpayInvoiceSchema,
	RazorpayPlanFetchedSchema,
	RazorpayRefundSchema,
	RazorpayRefundsListSchema,
	RazorpaySubscriptionSchema,
} from "../razorpay-schemas";

describe("RazorpayCustomerSchema", () => {
	it("parses a minimal customer", () => {
		const out = RazorpayCustomerSchema.parse({ id: "cust_1" });
		expect(out.id).toBe("cust_1");
	});

	it("preserves notes via passthrough", () => {
		const out = RazorpayCustomerSchema.parse({
			id: "cust_1",
			email: "x@y.com",
			notes: { profile_id: "uuid-1", source: "signup" },
			created_at: 1700000000, // unknown extra field
		});
		expect(out.notes?.profile_id).toBe("uuid-1");
		// extra fields don't crash but also don't get typed; raw is preserved
		expect((out as Record<string, unknown>).created_at).toBe(1700000000);
	});

	it("rejects when id is missing", () => {
		expect(() => RazorpayCustomerSchema.parse({ email: "x@y.com" })).toThrow();
	});
});

describe("RazorpaySubscriptionSchema", () => {
	it("parses an active subscription", () => {
		const out = RazorpaySubscriptionSchema.parse({
			id: "sub_1",
			status: "active",
			plan_id: "plan_1",
			current_start: 1700000000,
			current_end: 1702592000,
		});
		expect(out.status).toBe("active");
		expect(out.current_end).toBe(1702592000);
	});

	it("accepts null period bounds (mandate-flow intermediate)", () => {
		const out = RazorpaySubscriptionSchema.parse({
			id: "sub_1",
			status: "authenticated",
			plan_id: "plan_1",
			current_start: null,
			current_end: null,
		});
		expect(out.current_start).toBeNull();
	});

	it("requires plan_id (a missing plan_id is a real shape change worth catching)", () => {
		expect(() =>
			RazorpaySubscriptionSchema.parse({ id: "sub_1", status: "active" }),
		).toThrow();
	});
});

describe("RazorpayRefundSchema + RazorpayRefundsListSchema", () => {
	it("parses a refund with all fields", () => {
		const out = RazorpayRefundSchema.parse({
			id: "rfnd_1",
			amount: 50000,
			status: "processed",
			payment_id: "pay_1",
			notes: { source: "admin_panel", payment_row: "uuid-1" },
		});
		expect(out.id).toBe("rfnd_1");
		expect(out.notes?.source).toBe("admin_panel");
	});

	it("parses an empty refunds list", () => {
		const out = RazorpayRefundsListSchema.parse({ count: 0 });
		expect(out.items).toEqual([]);
	});

	it("parses a refunds list with multiple items", () => {
		const out = RazorpayRefundsListSchema.parse({
			count: 2,
			items: [
				{ id: "rfnd_1", status: "processed" },
				{ id: "rfnd_2", status: "failed" },
			],
		});
		expect(out.items).toHaveLength(2);
		expect(out.items[1]?.status).toBe("failed");
	});
});

describe("RazorpayInvoiceSchema", () => {
	it("parses an invoice with hosted url", () => {
		const out = RazorpayInvoiceSchema.parse({
			id: "inv_1",
			short_url: "https://rzp.io/i/abc",
			payment_id: "pay_1",
			status: "paid",
		});
		expect(out.short_url).toBe("https://rzp.io/i/abc");
	});
});

describe("RazorpayPlanFetchedSchema", () => {
	it("parses a plan with item.amount", () => {
		const out = RazorpayPlanFetchedSchema.parse({
			id: "plan_1",
			period: "monthly",
			interval: 1,
			item: { name: "Pro Monthly", amount: 60000, currency: "INR" },
		});
		expect(out.item?.amount).toBe(60000);
	});

	it("parses a plan without optional item", () => {
		const out = RazorpayPlanFetchedSchema.parse({ id: "plan_1" });
		expect(out.id).toBe("plan_1");
		expect(out.item).toBeUndefined();
	});
});
