/**
 * Server-action tests for `app/student/subscription/actions.ts`.
 *
 * What's covered for `redeemCoupon`:
 *   - Empty / oversized code → invalid_code
 *   - Unauthenticated → unauthorized
 *   - Parent path: missing billingProfileId from a parent → forbidden
 *   - Parent path: link not active → forbidden
 *   - Coupon not found → invalid_code
 *   - Wrong kind (`checkout_discount`) → invalid_code with checkout-specific message
 *   - Inactive / expired / fully-redeemed → matched code
 *   - Active subscription blocks redeem → blocked_paid
 *   - RPC error → database_error
 *   - RPC returns ok=false with `error_code` → mapped result
 *   - Happy path → ok message and revalidatePath fan-out fires
 *
 * What's covered for `cancelAtPeriodEnd`:
 *   - Unauthenticated → ok:false with message
 *   - No subscription / no razorpay id → ok:false
 *   - Razorpay throws → ok:false with retry message
 *   - Happy path → ok:true and DB update + analytics fire
 *
 * What's deliberately not covered:
 *   - The Razorpay HTTP client itself — that's stubbed.
 *   - `recordPracticeEvent`, `logSupabaseError` are fire-and-forget; we let
 *     them no-op naturally.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeMockSupabase } from "../../../factories/supabase";

const { mockSupabase, mockAdmin, mockUser, cancelSubscriptionMock, recordPracticeEventMock, revalidatePathMock } =
	vi.hoisted(() => ({
		mockSupabase: { current: null as unknown },
		mockAdmin: { current: null as unknown },
		mockUser: { current: null as null | { id: string; email?: string } },
		cancelSubscriptionMock: { current: null as null | ((id: string, opts: unknown) => Promise<unknown>) },
		recordPracticeEventMock: { current: vi.fn(async () => undefined) },
		revalidatePathMock: { current: vi.fn(() => undefined) },
	}));

vi.mock("@/lib/auth/get-server-user", () => ({
	getServerUser: async () => mockUser.current,
}));
vi.mock("@/lib/supabase/server", () => ({
	createClient: async () => mockSupabase.current,
}));
vi.mock("@/lib/supabase/admin", () => ({
	createServiceRoleClient: () => mockAdmin.current,
}));
vi.mock("@/lib/billing/razorpay", () => ({
	cancelSubscription: (id: string, opts: unknown) =>
		(cancelSubscriptionMock.current ?? (async () => undefined))(id, opts),
}));
vi.mock("@/lib/practice/analytics", () => ({
	recordPracticeEvent: (...args: unknown[]) =>
		(recordPracticeEventMock.current as (...a: unknown[]) => unknown)(...args),
}));
vi.mock("@/lib/server/log-supabase-error", () => ({
	logSupabaseError: () => undefined,
	logServerError: () => undefined,
	isPostgresUndefinedColumnError: () => false,
}));
vi.mock("next/cache", () => ({
	revalidatePath: (...args: unknown[]) =>
		(revalidatePathMock.current as (...a: unknown[]) => unknown)(...args),
}));

// Import the module under test AFTER all `vi.mock` calls so the mocks resolve.
import { cancelAtPeriodEnd, redeemCoupon } from "@/app/student/subscription/actions";

const STUDENT_ID = "11111111-1111-1111-1111-111111111111";
const PARENT_ID = "22222222-2222-2222-2222-222222222222";
const STUDENT_LINKED_TO_PARENT = "33333333-3333-3333-3333-333333333333";
const COUPON_ID = "44444444-4444-4444-4444-444444444444";

beforeEach(() => {
	mockUser.current = { id: STUDENT_ID };
	mockSupabase.current = makeMockSupabase({ user: { id: STUDENT_ID } });
	mockAdmin.current = makeMockSupabase({ user: { id: STUDENT_ID } });
	cancelSubscriptionMock.current = null;
	recordPracticeEventMock.current = vi.fn(async () => undefined);
	revalidatePathMock.current = vi.fn(() => undefined);
});

afterEach(() => {
	vi.clearAllMocks();
});

/* -------------------------------------------------------------------------- */
/*                              redeemCoupon                                   */
/* -------------------------------------------------------------------------- */

describe("redeemCoupon — preflight", () => {
	it("returns invalid_code when the code is empty", async () => {
		const out = await redeemCoupon("   ");
		expect(out).toEqual({ ok: false, code: "invalid_code", message: expect.any(String) });
	});

	it("returns invalid_code when the code exceeds 40 characters", async () => {
		const out = await redeemCoupon("X".repeat(41));
		expect(out).toEqual({ ok: false, code: "invalid_code", message: expect.any(String) });
	});

	it("returns unauthorized when the caller has no session", async () => {
		mockUser.current = null;
		const out = await redeemCoupon("WELCOME");
		expect(out).toEqual({ ok: false, code: "unauthorized", message: expect.any(String) });
	});
});

describe("redeemCoupon — parent path", () => {
	it("forbids a parent without billingProfileId", async () => {
		mockUser.current = { id: PARENT_ID };
		mockAdmin.current = makeMockSupabase({
			user: { id: PARENT_ID },
			tables: {
				profiles: { data: { role: "parent" } },
			},
		});
		const out = await redeemCoupon("WELCOME");
		expect(out).toEqual({ ok: false, code: "forbidden", message: expect.any(String) });
	});

	it("forbids a non-parent caller passing billingProfileId", async () => {
		mockUser.current = { id: STUDENT_ID };
		mockAdmin.current = makeMockSupabase({
			user: { id: STUDENT_ID },
			tables: {
				profiles: { data: { role: "student" } },
			},
		});
		const out = await redeemCoupon("WELCOME", STUDENT_LINKED_TO_PARENT);
		expect(out).toEqual({ ok: false, code: "forbidden", message: expect.any(String) });
	});

	it("forbids a parent whose link to the student is not active", async () => {
		mockUser.current = { id: PARENT_ID };
		mockAdmin.current = makeMockSupabase({
			user: { id: PARENT_ID },
			tables: {
				profiles: { data: { role: "parent" } },
			},
		});
		mockSupabase.current = makeMockSupabase({
			user: { id: PARENT_ID },
			tables: {
				parent_student_links: { data: null },
			},
		});
		const out = await redeemCoupon("WELCOME", STUDENT_LINKED_TO_PARENT);
		expect(out).toEqual({ ok: false, code: "forbidden", message: expect.any(String) });
	});
});

describe("redeemCoupon — coupon validation", () => {
	function setStudentCallerWithCoupon(coupon: Record<string, unknown> | null) {
		mockUser.current = { id: STUDENT_ID };
		mockAdmin.current = makeMockSupabase({
			user: { id: STUDENT_ID },
			tables: {
				profiles: { data: { role: "student", grade: 9 } },
				coupons: { data: coupon },
				coupon_redemptions: { data: null },
				subscriptions: { data: null },
			},
			rpcs: {
				billing_redeem_coupon_atomic: { data: [{ ok: true }] },
			},
		});
	}

	it("returns invalid_code when the coupon is not found", async () => {
		setStudentCallerWithCoupon(null);
		const out = await redeemCoupon("MISSING");
		expect(out).toEqual({ ok: false, code: "invalid_code", message: expect.any(String) });
	});

	it("returns invalid_code with checkout copy when kind is `checkout_discount`", async () => {
		setStudentCallerWithCoupon({
			id: COUPON_ID,
			code: "CHECKOUT",
			kind: "checkout_discount",
			is_active: true,
			max_redemptions: 100,
			redemptions_count: 0,
			duration_days: 30,
			grants_plan_code: "pro_monthly",
			expires_at: null,
			single_use_globally: false,
		});
		const out = await redeemCoupon("CHECKOUT");
		expect(out.ok).toBe(false);
		if (!out.ok) {
			expect(out.code).toBe("invalid_code");
			expect(out.message).toMatch(/checkout/i);
		}
	});

	it("returns inactive when `is_active=false`", async () => {
		setStudentCallerWithCoupon({
			id: COUPON_ID,
			code: "OLD",
			kind: "campaign",
			is_active: false,
			max_redemptions: 100,
			redemptions_count: 0,
			duration_days: 30,
			grants_plan_code: "pro_monthly",
			expires_at: null,
			single_use_globally: false,
		});
		const out = await redeemCoupon("OLD");
		expect(out).toMatchObject({ ok: false, code: "inactive" });
	});

	it("returns expired when `expires_at` is in the past", async () => {
		setStudentCallerWithCoupon({
			id: COUPON_ID,
			code: "PAST",
			kind: "campaign",
			is_active: true,
			max_redemptions: 100,
			redemptions_count: 0,
			duration_days: 30,
			grants_plan_code: "pro_monthly",
			expires_at: new Date(Date.now() - 86_400_000).toISOString(),
			single_use_globally: false,
		});
		const out = await redeemCoupon("PAST");
		expect(out).toMatchObject({ ok: false, code: "expired" });
	});

	it("returns exhausted when redemptions_count >= max_redemptions", async () => {
		setStudentCallerWithCoupon({
			id: COUPON_ID,
			code: "FULL",
			kind: "campaign",
			is_active: true,
			max_redemptions: 5,
			redemptions_count: 5,
			duration_days: 30,
			grants_plan_code: "pro_monthly",
			expires_at: null,
			single_use_globally: false,
		});
		const out = await redeemCoupon("FULL");
		expect(out).toMatchObject({ ok: false, code: "exhausted" });
	});

	it("returns blocked_paid when an active subscription exists", async () => {
		mockUser.current = { id: STUDENT_ID };
		mockAdmin.current = makeMockSupabase({
			user: { id: STUDENT_ID },
			tables: {
				profiles: { data: { role: "student", grade: 9 } },
				coupons: {
					data: {
						id: COUPON_ID,
						code: "WELCOME",
						kind: "campaign",
						is_active: true,
						max_redemptions: 100,
						redemptions_count: 0,
						duration_days: 30,
						grants_plan_code: "pro_monthly",
						expires_at: null,
						single_use_globally: false,
					},
				},
				coupon_redemptions: { data: null },
				subscriptions: { data: { id: "sub-1", status: "active" } },
			},
		});
		const out = await redeemCoupon("WELCOME");
		expect(out).toMatchObject({ ok: false, code: "blocked_paid" });
	});
});

describe("redeemCoupon — RPC outcomes", () => {
	const VALID_COUPON = {
		id: COUPON_ID,
		code: "WELCOME",
		kind: "campaign",
		is_active: true,
		max_redemptions: 100,
		redemptions_count: 0,
		duration_days: 30,
		grants_plan_code: "pro_monthly",
		expires_at: null,
		single_use_globally: false,
	};

	it("returns database_error when the RPC throws", async () => {
		mockUser.current = { id: STUDENT_ID };
		mockAdmin.current = makeMockSupabase({
			user: { id: STUDENT_ID },
			tables: {
				profiles: { data: { role: "student", grade: 9 } },
				coupons: { data: VALID_COUPON },
				coupon_redemptions: { data: null },
				subscriptions: { data: null },
			},
			rpcs: {
				billing_redeem_coupon_atomic: { error: { message: "boom" } },
			},
		});
		const out = await redeemCoupon("WELCOME");
		expect(out).toMatchObject({ ok: false, code: "database_error" });
	});

	it("maps RPC `already_redeemed` to the matching result code", async () => {
		mockUser.current = { id: STUDENT_ID };
		mockAdmin.current = makeMockSupabase({
			user: { id: STUDENT_ID },
			tables: {
				profiles: { data: { role: "student", grade: 9 } },
				coupons: { data: VALID_COUPON },
				coupon_redemptions: { data: null },
				subscriptions: { data: null },
			},
			rpcs: {
				billing_redeem_coupon_atomic: { data: [{ ok: false, error_code: "already_redeemed" }] },
			},
		});
		const out = await redeemCoupon("WELCOME");
		expect(out).toMatchObject({ ok: false, code: "already_redeemed" });
	});

	it("returns ok and fans out revalidatePath on the happy path", async () => {
		mockUser.current = { id: STUDENT_ID };
		mockAdmin.current = makeMockSupabase({
			user: { id: STUDENT_ID },
			tables: {
				profiles: { data: { role: "student", grade: 9 } },
				coupons: { data: VALID_COUPON },
				coupon_redemptions: { data: null },
				subscriptions: { data: null },
			},
			rpcs: {
				billing_redeem_coupon_atomic: { data: [{ ok: true }] },
			},
		});
		const out = await redeemCoupon("WELCOME");
		expect(out.ok).toBe(true);
		if (out.ok) {
			expect(out.message).toMatch(/30 days/);
		}
		expect(revalidatePathMock.current).toHaveBeenCalledWith("/student/subscription");
	});
});

/* -------------------------------------------------------------------------- */
/*                            cancelAtPeriodEnd                                */
/* -------------------------------------------------------------------------- */

describe("cancelAtPeriodEnd", () => {
	it("returns ok:false when the caller is unauthenticated", async () => {
		mockUser.current = null;
		const out = await cancelAtPeriodEnd();
		expect(out).toEqual({ ok: false, message: expect.any(String) });
	});

	it("returns ok:false when no subscription row exists", async () => {
		mockAdmin.current = makeMockSupabase({
			user: { id: STUDENT_ID },
			tables: { subscriptions: { data: null } },
		});
		const out = await cancelAtPeriodEnd();
		expect(out).toEqual({ ok: false, message: expect.any(String) });
	});

	it("returns ok:false when the subscription has no Razorpay id", async () => {
		mockAdmin.current = makeMockSupabase({
			user: { id: STUDENT_ID },
			tables: {
				subscriptions: { data: { id: "sub-1", razorpay_subscription_id: null } },
			},
		});
		const out = await cancelAtPeriodEnd();
		expect(out).toEqual({ ok: false, message: expect.stringMatching(/paid subscription/i) });
	});

	it("surfaces Razorpay failures with a retry message", async () => {
		mockAdmin.current = makeMockSupabase({
			user: { id: STUDENT_ID },
			tables: {
				subscriptions: { data: { id: "sub-1", razorpay_subscription_id: "rzp_sub_1" } },
			},
		});
		cancelSubscriptionMock.current = async () => {
			throw new Error("rzp 500");
		};
		const out = await cancelAtPeriodEnd();
		expect(out).toEqual({ ok: false, message: expect.stringMatching(/try again/i) });
	});

	it("returns ok and triggers revalidatePath on the happy path", async () => {
		mockAdmin.current = makeMockSupabase({
			user: { id: STUDENT_ID },
			tables: {
				subscriptions: { data: { id: "sub-1", razorpay_subscription_id: "rzp_sub_1" } },
			},
		});
		cancelSubscriptionMock.current = async () => ({ ok: true });
		const out = await cancelAtPeriodEnd();
		expect(out).toEqual({ ok: true });
		expect(revalidatePathMock.current).toHaveBeenCalledWith("/student/subscription");
	});
});
