/**
 * Unit tests for `writeParentAudit` — covers retry-on-failure, never-throws,
 * and ip-sanitization. The integration shape (insert actually lands in
 * Postgres + RLS rejects non-service-role reads) is not exercised here;
 * a future gated integration test can mirror tests/admin/immutability.test.ts
 * when needed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const insertMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
	createServiceRoleClient: () => ({
		from: () => ({
			insert: insertMock,
		}),
	}),
}));

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
}));

import * as Sentry from "@sentry/nextjs";

import { PARENT_ACTIONS } from "@/lib/parent/audit-actions";
import { writeParentAudit } from "@/lib/parent/audit";

describe("writeParentAudit", () => {
	beforeEach(() => {
		insertMock.mockReset();
		(Sentry.captureMessage as unknown as ReturnType<typeof vi.fn>).mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns true on first-attempt success", async () => {
		insertMock.mockResolvedValueOnce({ error: null });
		const ok = await writeParentAudit({
			action: PARENT_ACTIONS.SELECT_STUDENT,
			parentId: "00000000-0000-0000-0000-000000000001",
			targetType: "student",
			targetId: "00000000-0000-0000-0000-000000000002",
		});
		expect(ok).toBe(true);
		expect(insertMock).toHaveBeenCalledTimes(1);
		const row = insertMock.mock.calls[0]?.[0] as Record<string, unknown>;
		expect(row).toMatchObject({
			parent_id: "00000000-0000-0000-0000-000000000001",
			action: "select_student",
			target_type: "student",
			target_id: "00000000-0000-0000-0000-000000000002",
		});
		expect(Sentry.captureMessage).not.toHaveBeenCalled();
	});

	it("retries on failure and returns true once an attempt succeeds", async () => {
		insertMock
			.mockResolvedValueOnce({ error: { message: "transient" } })
			.mockResolvedValueOnce({ error: null });
		const ok = await writeParentAudit({
			action: PARENT_ACTIONS.LINK_CHILD_SUCCESS,
			parentId: "00000000-0000-0000-0000-000000000001",
		});
		expect(ok).toBe(true);
		expect(insertMock).toHaveBeenCalledTimes(2);
		expect(Sentry.captureMessage).not.toHaveBeenCalled();
	});

	it("returns false after retry exhaustion (3 failed attempts) and reports to Sentry", async () => {
		insertMock.mockResolvedValue({ error: { message: "persistent" } });
		const ok = await writeParentAudit({
			action: PARENT_ACTIONS.SELECT_STUDENT_UNAUTHORIZED,
			parentId: "00000000-0000-0000-0000-000000000001",
		});
		expect(ok).toBe(false);
		expect(insertMock).toHaveBeenCalledTimes(3);
		expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
		const [msg, opts] = (Sentry.captureMessage as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
			string,
			{ level?: string; tags?: Record<string, string>; extra?: Record<string, unknown> },
		];
		expect(msg).toBe("parent_audit_retry_exhausted");
		expect(opts?.level).toBe("error");
		expect(opts?.tags).toMatchObject({ feature: "parent", phase: "audit_insert" });
	});

	it("does not throw when the insert call itself rejects", async () => {
		insertMock.mockRejectedValue(new Error("network down"));
		await expect(
			writeParentAudit({
				action: PARENT_ACTIONS.LINK_CHILD_FAILED,
				parentId: "00000000-0000-0000-0000-000000000001",
			}),
		).resolves.toBe(false);
		expect(insertMock).toHaveBeenCalledTimes(3);
	});

	it("sanitizes the ip address before inserting (drops non-IP strings)", async () => {
		insertMock.mockResolvedValue({ error: null });
		await writeParentAudit({
			action: PARENT_ACTIONS.SELECT_STUDENT,
			parentId: "00000000-0000-0000-0000-000000000001",
			ipAddress: "not-an-ip",
		});
		const row = insertMock.mock.calls[0]?.[0] as Record<string, unknown>;
		expect(row.ip_address).toBeNull();
	});

	it("preserves a valid ipv4 address", async () => {
		insertMock.mockResolvedValue({ error: null });
		await writeParentAudit({
			action: PARENT_ACTIONS.SELECT_STUDENT,
			parentId: "00000000-0000-0000-0000-000000000001",
			ipAddress: "203.0.113.4",
		});
		const row = insertMock.mock.calls[0]?.[0] as Record<string, unknown>;
		expect(row.ip_address).toBe("203.0.113.4");
	});
});
