"use server";

import { getCachedAppProfileRow } from "@/lib/auth/cached-profile";
import { getServerUser } from "@/lib/auth/get-server-user";
import { assertParentActiveLink } from "@/lib/parent/linked-children";
import { getParentActiveStudentIdFromCookie } from "@/lib/parent/active-student-cookie";
import { loadStudentReportsList } from "@/lib/student/load-student-reports-list";
import type { StudentReportTestRowSerialized } from "@/lib/student/subject-test-report";
import { createClient } from "@/lib/supabase/server";

async function resolveReportsStudentId(): Promise<
	{ ok: true; studentId: string } | { ok: false; message: string }
> {
	const user = await getServerUser();
	if (!user) {
		return { ok: false, message: "Not signed in." };
	}

	const profile = await getCachedAppProfileRow();
	if (profile?.role === "parent") {
		const activeChildId = await getParentActiveStudentIdFromCookie();
		if (!activeChildId) {
			return { ok: false, message: "Select a linked student first." };
		}
		const linked = await assertParentActiveLink(user.id, activeChildId);
		if (!linked) {
			return { ok: false, message: "Select a linked student first." };
		}
		return { ok: true, studentId: activeChildId };
	}

	return { ok: true, studentId: user.id };
}

export async function loadOlderStudentReports(beforeTestDateIso: string): Promise<
	| { ok: true; tests: StudentReportTestRowSerialized[] }
	| { ok: false; message: string }
> {
	if (!beforeTestDateIso?.trim()) {
		return { ok: false, message: "Missing cursor." };
	}

	const resolved = await resolveReportsStudentId();
	if (!resolved.ok) {
		return resolved;
	}

	const supabase = await createClient();
	const { tests, loadError } = await loadStudentReportsList(supabase, resolved.studentId, {
		beforeTestDateIso: beforeTestDateIso.trim(),
		logContext: "loadOlderStudentReports",
	});

	if (loadError) {
		return { ok: false, message: loadError };
	}
	return { ok: true, tests };
}
