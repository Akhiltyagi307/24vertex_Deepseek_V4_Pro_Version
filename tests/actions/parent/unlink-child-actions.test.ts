/**
 * Server-action tests for `unlinkParentFromStudent`.
 *
 * Covers:
 *   - Invalid (non-UUID) studentId → error, no RPC call
 *   - No signed-in user → error
 *   - RPC failure → error message + failure audit row
 *   - Success → audit, active-student cookie cleared if it matched, revalidates parent layout
 *   - Success but cookie pointed at a different student → cookie left intact
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeMockSupabase } from "../../factories/supabase";

const {
	mockSupabase,
	mockUser,
	auditMock,
	headersMock,
	cookieStoreMock,
	revalidateMock,
} = vi.hoisted(() => {
	const get = vi.fn();
	const set = vi.fn();
	const del = vi.fn();
	return {
		mockSupabase: { current: null as unknown },
		mockUser: { current: null as null | { id: string } },
		auditMock: { current: vi.fn(async () => undefined) },
		headersMock: {
			current: () => ({
				get: (k: string) => (k.toLowerCase() === "user-agent" ? "vitest" : null),
			}),
		},
		cookieStoreMock: { current: { get, set, delete: del } },
		revalidateMock: { current: vi.fn() },
	};
});

vi.mock("@/lib/supabase/server", () => ({
	createClient: async () => mockSupabase.current,
}));
vi.mock("@/lib/auth/get-server-user", () => ({
	getServerUser: async () => mockUser.current,
}));
vi.mock("@/lib/parent/audit", () => ({
	writeParentAudit: (...args: unknown[]) =>
		(auditMock.current as (...a: unknown[]) => unknown)(...args),
}));
vi.mock("next/headers", () => ({
	headers: async () => headersMock.current(),
	cookies: async () => cookieStoreMock.current,
}));
vi.mock("next/cache", () => ({
	revalidatePath: (...args: unknown[]) =>
		(revalidateMock.current as (...a: unknown[]) => unknown)(...args),
}));
vi.mock("@/lib/admin/api-request-meta", () => ({
	clientIpFromHeaders: () => "127.0.0.1",
}));
vi.mock("@/lib/server/log-supabase-error", () => ({
	logSupabaseError: () => undefined,
}));
vi.mock("@sentry/nextjs", () => ({
	startSpan: <T,>(_opts: unknown, fn: () => T) => fn(),
}));

import { unlinkParentFromStudent } from "@/app/parent/(portal)/settings/unlink-actions";

const PARENT_ID = "11111111-1111-1111-1111-111111111111";
const STUDENT_ID = "22222222-2222-2222-2222-222222222222";

beforeEach(() => {
	mockUser.current = { id: PARENT_ID };
	mockSupabase.current = makeMockSupabase({
		user: { id: PARENT_ID },
		rpcs: { unlink_parent_from_student: { error: null } },
	});
	auditMock.current = vi.fn(async () => undefined);
	(cookieStoreMock.current.get as ReturnType<typeof vi.fn>).mockReset();
	(cookieStoreMock.current.set as ReturnType<typeof vi.fn>).mockReset();
	(cookieStoreMock.current.delete as ReturnType<typeof vi.fn>).mockReset();
	revalidateMock.current = vi.fn();
});

afterEach(() => {
	vi.clearAllMocks();
});

function fd(entries: Record<string, string>): FormData {
	const f = new FormData();
	for (const [k, v] of Object.entries(entries)) f.append(k, v);
	return f;
}

describe("unlinkParentFromStudent", () => {
	it("returns an error when studentId is missing or malformed", async () => {
		const out = await unlinkParentFromStudent({}, fd({ studentId: "not-a-uuid" }));
		expect(out.error).toBeTruthy();
		expect(auditMock.current).not.toHaveBeenCalled();
	});

	it("returns an error when no user is signed in", async () => {
		mockUser.current = null;
		const out = await unlinkParentFromStudent({}, fd({ studentId: STUDENT_ID }));
		expect(out.error).toBeTruthy();
	});

	it("returns an error and writes failure audit when RPC fails", async () => {
		mockSupabase.current = makeMockSupabase({
			user: { id: PARENT_ID },
			rpcs: { unlink_parent_from_student: { error: { message: "denied" } } },
		});
		const out = await unlinkParentFromStudent({}, fd({ studentId: STUDENT_ID }));
		expect(out.error).toBeTruthy();
		expect(auditMock.current).toHaveBeenCalledWith(
			expect.objectContaining({
				action: expect.stringMatching(/unlink_child/i),
				payload: expect.objectContaining({ outcome: "failed" }),
			}),
		);
	});

	it("clears the active-student cookie when it matches the unlinked child", async () => {
		(cookieStoreMock.current.get as ReturnType<typeof vi.fn>).mockReturnValue({
			value: STUDENT_ID,
		});
		const out = await unlinkParentFromStudent({}, fd({ studentId: STUDENT_ID }));
		expect(out.success).toBe(true);
		expect(cookieStoreMock.current.delete).toHaveBeenCalledWith(
			"eduai_parent_active_student",
		);
		expect(revalidateMock.current).toHaveBeenCalledWith("/parent", "layout");
	});

	it("leaves the active-student cookie alone when it points at a different child", async () => {
		const OTHER = "33333333-3333-3333-3333-333333333333";
		(cookieStoreMock.current.get as ReturnType<typeof vi.fn>).mockReturnValue({
			value: OTHER,
		});
		const out = await unlinkParentFromStudent({}, fd({ studentId: STUDENT_ID }));
		expect(out.success).toBe(true);
		expect(cookieStoreMock.current.delete).not.toHaveBeenCalled();
	});

	it("writes a success audit row with the unlinked student id", async () => {
		await unlinkParentFromStudent({}, fd({ studentId: STUDENT_ID }));
		expect(auditMock.current).toHaveBeenCalledWith(
			expect.objectContaining({
				action: expect.stringMatching(/unlink_child/i),
				parentId: PARENT_ID,
				targetId: STUDENT_ID,
				payload: expect.objectContaining({ outcome: "ok" }),
			}),
		);
	});
});
