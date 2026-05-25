import type { createClient } from "@/lib/supabase/server";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

export type OwnedTestRow = {
	id: string;
	student_id: string;
	status: string;
	subject_id?: string | null;
};

/**
 * Verifies the authenticated student owns the test row. Optional `status`
 * filter (single value or list) for in-session mutations.
 */
export async function assertTestOwnedByStudent(
	supabase: ServerSupabase,
	testId: string,
	studentId: string,
	opts?: { status?: string | string[] },
): Promise<{ ok: true; test: OwnedTestRow } | { ok: false; message: string }> {
	const { data: test, error } = await supabase
		.from("tests")
		.select("id, student_id, status, subject_id")
		.eq("id", testId)
		.maybeSingle();

	if (error || !test) {
		return { ok: false, message: "Test not found." };
	}
	if (test.student_id !== studentId) {
		return { ok: false, message: "You do not have access to this test." };
	}
	if (opts?.status !== undefined) {
		const allowed = Array.isArray(opts.status) ? opts.status : [opts.status];
		if (!allowed.includes(test.status as string)) {
			return { ok: false, message: "This test is not in the right state for that action." };
		}
	}
	return {
		ok: true,
		test: {
			id: test.id as string,
			student_id: test.student_id as string,
			status: test.status as string,
			subject_id: (test.subject_id as string | null) ?? null,
		},
	};
}

export async function assertTestOwnedInProgress(
	supabase: ServerSupabase,
	testId: string,
	studentId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
	const gate = await assertTestOwnedByStudent(supabase, testId, studentId, {
		status: "in_progress",
	});
	if (!gate.ok) {
		if (gate.message === "This test is not in the right state for that action.") {
			return { ok: false, message: "This test is no longer in progress." };
		}
		return gate;
	}
	return { ok: true };
}
