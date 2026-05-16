import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const rpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
	createClient: async () => ({ rpc }),
}));

describe("teacher student access helpers", () => {
	beforeEach(() => {
		rpc.mockReset();
	});

	it("filters accessible student ids through the batched RPC", async () => {
		const access = await import("@/lib/teachers/teacher-student-access");
		rpc.mockResolvedValueOnce({ data: ["student-1", "student-3"], error: null });

		const result = await access.teacherFilterAccessibleStudentIdsForSession("teacher-1", [
			"student-1",
			"student-2",
			"student-3",
		]);

		expect(result).toEqual(new Set(["student-1", "student-3"]));
		expect(rpc).toHaveBeenCalledWith("teacher_filter_accessible_student_ids", {
			p_teacher_id: "teacher-1",
			p_student_ids: ["student-1", "student-2", "student-3"],
		});
	});

	it("fails closed when the batched RPC errors", async () => {
		const access = await import("@/lib/teachers/teacher-student-access");
		rpc.mockResolvedValueOnce({ data: null, error: { message: "denied" } });

		const result = await access.teacherFilterAccessibleStudentIdsForSession("teacher-1", ["student-1"]);

		expect(result).toEqual(new Set());
	});
});
