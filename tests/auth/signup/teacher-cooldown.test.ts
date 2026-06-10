import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getServerUser = vi.fn();
const hasRecentTeacherRejection = vi.fn();
const sendTeacherPendingApprovalEmail = vi.fn();
const supabaseRpc = vi.fn();
const redirectFn = vi.fn();
const consumeAuthSignup = vi.fn();

class RedirectAbort extends Error {
	constructor(public to: string) {
		super("redirect");
	}
}

vi.mock("@/lib/auth/get-server-user", () => ({ getServerUser }));
vi.mock("@/lib/auth/teacher-recent-rejection-check", () => ({ hasRecentTeacherRejection }));
vi.mock("@/lib/email/teacher-pending-approval-email", () => ({ sendTeacherPendingApprovalEmail }));
vi.mock("@/lib/supabase/server", () => ({
	createClient: () => Promise.resolve({ rpc: (...args: unknown[]) => supabaseRpc(...args) }),
}));
vi.mock("next/navigation", () => ({
	redirect: (to: string) => {
		redirectFn(to);
		throw new RedirectAbort(to);
	},
}));
vi.mock("next/headers", () => ({ headers: async () => new Map<string, string>() }));
vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
}));
vi.mock("@/lib/server/log-supabase-error", () => ({ logSupabaseError: vi.fn() }));
vi.mock("@/lib/auth/audit", () => ({ writeAuthAudit: vi.fn() }));
vi.mock("@/lib/auth/audit-actions", () => ({
	AUTH_ACTIONS: { SIGNUP_COMPLETED: "signup_completed" },
}));
vi.mock("@/lib/http/client-ip", () => ({ clientIpFromHeaders: () => null }));
// Rate limiter is a separate concern (tested in tests/auth/rate-limit.test.ts);
// mock it here so the cooldown/register assertions don't depend on a live
// rate-limit backend (which CI lacks — the real rlConsume trips its circuit).
vi.mock("@/lib/auth/rate-limit", () => ({ consumeAuthSignup }));

function buildFormData(): FormData {
	const fd = new FormData();
	fd.set("email", "teacher@example.com");
	fd.set("password", "supersecret123");
	fd.set("fullName", "Jane Teacher");
	fd.set("phone", "9999999999");
	fd.set("schoolName", "Public School #1");
	return fd;
}

describe("completeTeacherRegistration cooldown integration", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		getServerUser.mockResolvedValue({ id: "user-1", email: "teacher@example.com" });
		consumeAuthSignup.mockResolvedValue({ ok: true });
	});

	it("returns a cooldown error when hasRecentTeacherRejection is active", async () => {
		const retry = new Date(Date.now() + 12 * 60 * 60 * 1000);
		hasRecentTeacherRejection.mockResolvedValue({ cooldownActive: true, retryAfter: retry });
		const { completeTeacherRegistration } = await import(
			"@/app/(auth)/signup/teacher/actions"
		);
		const result = await completeTeacherRegistration(undefined, buildFormData());
		expect(result?.error).toMatch(/recently rejected/i);
		expect(supabaseRpc).not.toHaveBeenCalled();
	});

	it("proceeds to register_teacher RPC when no cooldown is active", async () => {
		hasRecentTeacherRejection.mockResolvedValue({ cooldownActive: false });
		supabaseRpc.mockResolvedValue({ error: null });
		sendTeacherPendingApprovalEmail.mockResolvedValue({ ok: true });
		const { completeTeacherRegistration } = await import(
			"@/app/(auth)/signup/teacher/actions"
		);
		await expect(
			completeTeacherRegistration(undefined, buildFormData()),
		).rejects.toBeInstanceOf(RedirectAbort);
		expect(supabaseRpc).toHaveBeenCalledWith(
			"register_teacher",
			expect.objectContaining({ p_full_name: "Jane Teacher" }),
		);
		expect(redirectFn).toHaveBeenCalledWith("/teacher/pending");
	});
});
