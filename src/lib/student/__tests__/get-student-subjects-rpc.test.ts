import { describe, expect, it, vi } from "vitest";

import { getStudentSubjectsRpc } from "@/lib/student/get-student-subjects-rpc";

type RpcResponse<T> = Promise<{ data: T[] | null; error: { code?: string; message: string } | null }>;

function buildSupabaseMock<T>(impl: (args: unknown) => RpcResponse<T>) {
	return {
		rpc: vi.fn((_fn: string, args: unknown) => impl(args)),
	};
}

describe("getStudentSubjectsRpc", () => {
	it("falls back to legacy elective param name on PGRST202", async () => {
		const rows = [{ id: "sub-1", name: "Math" }];
		const supabase = buildSupabaseMock(async (args) => {
			const a = args as Record<string, unknown>;
			if ("p_elective_subject_id" in a) {
				return { data: rows, error: null };
			}
			return {
				data: null,
				error: {
					code: "PGRST202",
					message: "Could not find the function public.get_student_subjects(p_elective_id, p_grade, p_stream)",
				},
			};
		});

		const result = await getStudentSubjectsRpc<{ id: string; name: string }>(supabase as never, {
			p_grade: 11,
			p_stream: "science",
			p_elective_id: "uuid-1",
		});

		expect(result.error).toBeNull();
		expect(result.data).toEqual(rows);
		expect(supabase.rpc).toHaveBeenCalledTimes(2);
		expect(supabase.rpc.mock.calls[1][1]).toMatchObject({
			p_grade: 11,
			p_stream: "science",
			p_elective_subject_id: "uuid-1",
		});
	});

	it("returns primary error for non-signature failures", async () => {
		const supabase = buildSupabaseMock(async () => ({
			data: null,
			error: { code: "42501", message: "permission denied" },
		}));

		const result = await getStudentSubjectsRpc<{ id: string; name: string }>(supabase as never, {
			p_grade: 9,
			p_stream: null,
			p_elective_id: null,
		});

		expect(result.error?.code).toBe("42501");
		expect(supabase.rpc).toHaveBeenCalledTimes(1);
	});

	it("falls back to direct subjects query when rpc signatures are missing", async () => {
		const rows = [{ id: "sub-1", name: "Math" }];
		const query = {
			eq: vi.fn().mockReturnThis(),
			order: vi.fn(async () => ({ data: rows, error: null })),
		};
		const supabase = {
			rpc: vi.fn(async () => ({
				data: null,
				error: {
					code: "PGRST202",
					message: "Could not find the function public.get_student_subjects(p_elective_id, p_grade, p_stream)",
				},
			})),
			from: vi.fn(() => ({
				select: vi.fn(() => query),
			})),
		};

		const result = await getStudentSubjectsRpc<{ id: string; name: string }>(supabase as never, {
			p_grade: 9,
			p_stream: null,
			p_elective_id: null,
		});

		expect(result.error).toBeNull();
		expect(result.data).toEqual(rows);
		expect(supabase.rpc).toHaveBeenCalledTimes(2);
		expect(supabase.from).toHaveBeenCalledWith("subjects");
	});
});
