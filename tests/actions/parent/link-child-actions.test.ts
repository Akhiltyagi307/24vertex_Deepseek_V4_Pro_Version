/**
 * Server-action tests for `linkParentToStudent`.
 *
 * What's covered:
 *   - Invalid payload (missing / malformed studentId) → error
 *   - RPC error: maps via classifyLinkParentRpc + writes failure audit
 *   - Happy path: writes success audit, attempts notifications, then redirects
 *
 * Notes:
 *   - `redirect("/parent/dashboard")` throws NEXT_REDIRECT — we mock it to a
 *     plain throw so we can detect the redirect path in tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeMockSupabase } from "../../factories/supabase";

const {
	mockSupabase,
	mockUser,
	resolveStudentMock,
	classifyMock,
	auditMock,
	processNotificationsMock,
	redirectMock,
	headersMock,
	rateLimitPerParentMock,
	rateLimitPerStudentMock,
	sentryMetricsMock,
} = vi.hoisted(() => ({
	mockSupabase: { current: null as unknown },
	mockUser: { current: null as null | { id: string } },
	resolveStudentMock: {
		current: vi.fn(async (_sb: unknown, ref: string): Promise<string | null> => ref),
	},
	classifyMock: { current: vi.fn(() => "generic" as string) },
	auditMock: { current: vi.fn(async () => undefined) },
	processNotificationsMock: { current: vi.fn(async () => undefined) },
	redirectMock: {
		current: vi.fn((url: string) => {
			const err = new Error(`NEXT_REDIRECT:${url}`);
			(err as { digest?: string }).digest = `NEXT_REDIRECT;replace;${url};308;`;
			throw err;
		}),
	},
	headersMock: {
		current: () => ({
			get: (k: string) => (k.toLowerCase() === "user-agent" ? "vitest" : null),
		}),
	},
	rateLimitPerParentMock: {
		current: vi.fn(async (): Promise<{ ok: true } | { ok: false; result: unknown; limit: number }> => ({
			ok: true,
		})),
	},
	rateLimitPerStudentMock: {
		current: vi.fn(async (): Promise<{ ok: true } | { ok: false; result: unknown; limit: number }> => ({
			ok: true,
		})),
	},
	sentryMetricsMock: { current: vi.fn() },
}));

vi.mock("@/lib/supabase/server", () => ({
	createClient: async () => mockSupabase.current,
}));
vi.mock("next/headers", () => ({
	headers: async () => headersMock.current(),
}));
vi.mock("next/navigation", () => ({
	redirect: (url: string) => redirectMock.current(url),
}));
vi.mock("@/lib/auth/link-parent-rpc-errors", () => ({
	classifyLinkParentRpc: () => classifyMock.current(),
	formatLinkParentRpcDevDetails: () => null,
	userMessageForLinkParentRpcFailure: (k: string) => `error_for_${k}`,
}));
vi.mock("@/lib/auth/resolve-student-link-ref", () => ({
	resolveStudentProfileIdForLinkRef: (sb: unknown, ref: string) =>
		resolveStudentMock.current(sb, ref),
}));
vi.mock("@/lib/parent/audit", () => ({
	writeParentAudit: (...args: unknown[]) =>
		(auditMock.current as (...a: unknown[]) => unknown)(...args),
}));
vi.mock("@/lib/parent/process-parent-link-notifications", () => ({
	processParentLinkNotifications: (...args: unknown[]) =>
		(processNotificationsMock.current as (...a: unknown[]) => unknown)(...args),
}));
vi.mock("@/lib/admin/api-request-meta", () => ({
	clientIpFromHeaders: () => "127.0.0.1",
}));
vi.mock("@/lib/server/log-supabase-error", () => ({
	logSupabaseError: () => undefined,
	logServerError: () => undefined,
	isPostgresUndefinedColumnError: () => false,
}));
vi.mock("@/lib/parent/rate-limit", () => ({
	consumeParentLinkPerParent: (...args: unknown[]) =>
		(rateLimitPerParentMock.current as (...a: unknown[]) => unknown)(...args),
	consumeParentLinkPerStudent: (...args: unknown[]) =>
		(rateLimitPerStudentMock.current as (...a: unknown[]) => unknown)(...args),
}));
vi.mock("@sentry/nextjs", () => ({
	captureException: () => undefined,
	captureMessage: () => undefined,
	metrics: {
		count: (...args: unknown[]) =>
			(sentryMetricsMock.current as (...a: unknown[]) => unknown)(...args),
	},
}));

import { linkParentToStudent } from "@/app/parent/link-child/actions";

const PARENT_ID = "11111111-1111-1111-1111-111111111111";
const STUDENT_REF_CODE = "AB1234";
const STUDENT_PROFILE_ID = "22222222-2222-2222-2222-222222222222";

beforeEach(() => {
	mockUser.current = { id: PARENT_ID };
	mockSupabase.current = makeMockSupabase({
		user: { id: PARENT_ID },
		rpcs: { link_parent_to_student: { data: "active", error: null } },
	});
	resolveStudentMock.current = vi.fn(async () => STUDENT_PROFILE_ID);
	classifyMock.current = vi.fn(() => "generic" as const);
	auditMock.current = vi.fn(async () => undefined);
	processNotificationsMock.current = vi.fn(async () => undefined);
	redirectMock.current = vi.fn((url: string) => {
		const err = new Error(`NEXT_REDIRECT:${url}`);
		(err as { digest?: string }).digest = `NEXT_REDIRECT;replace;${url};308;`;
		throw err;
	});
	rateLimitPerParentMock.current = vi.fn(async () => ({ ok: true as const }));
	rateLimitPerStudentMock.current = vi.fn(async () => ({ ok: true as const }));
	sentryMetricsMock.current = vi.fn();
});

afterEach(() => {
	vi.clearAllMocks();
});

function fd(entries: Record<string, string>): FormData {
	const f = new FormData();
	for (const [k, v] of Object.entries(entries)) f.append(k, v);
	return f;
}

describe("linkParentToStudent", () => {
	it("returns an error when studentId is missing or malformed", async () => {
		const out = await linkParentToStudent({}, fd({ studentId: "BAD" }));
		expect(out.error).toBeTruthy();
	});

	it("maps an RPC failure via classifyLinkParentRpc and records a failure audit", async () => {
		mockSupabase.current = makeMockSupabase({
			user: { id: PARENT_ID },
			rpcs: { link_parent_to_student: { error: { message: "wrong_code" } } },
		});
		classifyMock.current = vi.fn(() => "wrong_code" as string);
		const out = await linkParentToStudent({}, fd({ studentId: STUDENT_REF_CODE }));
		expect(out).toEqual({ error: "error_for_wrong_code" });
		expect(auditMock.current).toHaveBeenCalledWith(
			expect.objectContaining({
				action: expect.stringMatching(/link_child_failed/i),
				parentId: PARENT_ID,
			}),
		);
	});

	it("redirects to /parent/dashboard on success and writes a success audit", async () => {
		await expect(linkParentToStudent({}, fd({ studentId: STUDENT_REF_CODE }))).rejects.toThrow(
			/NEXT_REDIRECT:\/parent\/dashboard/,
		);
		expect(redirectMock.current).toHaveBeenCalledWith("/parent/dashboard");
		expect(auditMock.current).toHaveBeenCalledWith(
			expect.objectContaining({
				action: expect.stringMatching(/link_child_success/i),
				parentId: PARENT_ID,
				targetId: STUDENT_PROFILE_ID,
			}),
		);
	});

	it("redirects to pending UX when RPC returns pending", async () => {
		mockSupabase.current = makeMockSupabase({
			user: { id: PARENT_ID },
			rpcs: { link_parent_to_student: { data: "pending", error: null } },
		});
		await expect(linkParentToStudent({}, fd({ studentId: STUDENT_REF_CODE }))).rejects.toThrow(
			/NEXT_REDIRECT:\/parent\/link-child\?status=pending/,
		);
		expect(processNotificationsMock.current).toHaveBeenCalledWith(
			expect.objectContaining({ linkStatus: "pending" }),
		);
	});

	it("still redirects when processParentLinkNotifications runs on success", async () => {
		await expect(linkParentToStudent({}, fd({ studentId: STUDENT_REF_CODE }))).rejects.toThrow(
			/NEXT_REDIRECT:\/parent\/dashboard/,
		);
		expect(processNotificationsMock.current).toHaveBeenCalledWith(
			expect.objectContaining({ linkStatus: "active", parentId: PARENT_ID }),
		);
	});

	it("returns throttled error and writes throttled audit when per-parent rate limit denies", async () => {
		rateLimitPerParentMock.current = vi.fn(async () => ({
			ok: false as const,
			result: { resetAt: new Date(Date.now() + 60_000) },
			limit: 10,
		}));
		const out = await linkParentToStudent({}, fd({ studentId: STUDENT_REF_CODE }));
		expect(out.error).toMatch(/too many/i);
		expect(auditMock.current).toHaveBeenCalledWith(
			expect.objectContaining({
				action: expect.stringMatching(/link_child_throttled/i),
				payload: expect.objectContaining({ scope: "per_parent" }),
			}),
		);
		// RPC must not run when throttled at the parent layer.
		expect(redirectMock.current).not.toHaveBeenCalled();
	});

	it("returns throttled error when per-student-reference rate limit denies", async () => {
		rateLimitPerStudentMock.current = vi.fn(async () => ({
			ok: false as const,
			result: { resetAt: new Date(Date.now() + 60_000) },
			limit: 5,
		}));
		const out = await linkParentToStudent({}, fd({ studentId: STUDENT_REF_CODE }));
		expect(out.error).toMatch(/too many/i);
		expect(auditMock.current).toHaveBeenCalledWith(
			expect.objectContaining({
				action: expect.stringMatching(/link_child_throttled/i),
				payload: expect.objectContaining({ scope: "per_student_ref" }),
			}),
		);
	});

	it("increments parent.link.success counter on success", async () => {
		await expect(linkParentToStudent({}, fd({ studentId: STUDENT_REF_CODE }))).rejects.toThrow(
			/NEXT_REDIRECT/,
		);
		const successCalls = sentryMetricsMock.current.mock.calls.filter(
			(c) => (c as unknown[])[0] === "parent.link.success",
		);
		expect(successCalls).toHaveLength(1);
	});

	it("increments parent.link.failure counter with reason tag on RPC error", async () => {
		mockSupabase.current = makeMockSupabase({
			user: { id: PARENT_ID },
			rpcs: { link_parent_to_student: { error: { message: "wrong_code" } } },
		});
		classifyMock.current = vi.fn(() => "wrong_code");
		await linkParentToStudent({}, fd({ studentId: STUDENT_REF_CODE }));
		const failureCalls = sentryMetricsMock.current.mock.calls.filter(
			(c) => (c as unknown[])[0] === "parent.link.failure",
		);
		expect(failureCalls).toHaveLength(1);
		expect((failureCalls[0] as unknown[])[2]).toMatchObject({
			attributes: { reason: "wrong_code" },
		});
	});
});
