import { describe, expect, it, vi } from "vitest";

import { assertTestOwnedByStudent } from "@/lib/practice/test-ownership";

function mockSupabaseForTest(row: Record<string, unknown> | null) {
	return {
		from: vi.fn(() => ({
			select: vi.fn(() => ({
				eq: vi.fn(() => ({
					maybeSingle: vi.fn(async () => ({
						data: row,
						error: row ? null : { message: "not found" },
					})),
				})),
			})),
		})),
	} as never;
}

describe("assertTestOwnedByStudent", () => {
	it("rejects when student_id does not match", async () => {
		const supabase = mockSupabaseForTest({
			id: "t1",
			student_id: "other",
			status: "in_progress",
		});
		const result = await assertTestOwnedByStudent(supabase, "t1", "me");
		expect(result).toEqual({
			ok: false,
			message: "You do not have access to this test.",
		});
	});

	it("accepts in_progress when status filter matches", async () => {
		const supabase = mockSupabaseForTest({
			id: "t1",
			student_id: "me",
			status: "in_progress",
			subject_id: "sub",
		});
		const result = await assertTestOwnedByStudent(supabase, "t1", "me", {
			status: "in_progress",
		});
		expect(result.ok).toBe(true);
	});
});
