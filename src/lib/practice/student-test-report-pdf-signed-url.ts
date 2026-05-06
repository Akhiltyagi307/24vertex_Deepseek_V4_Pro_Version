import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";

/** Long-lived link for email recipients; no EduAI login required (Supabase token in URL). */
export const STUDENT_TEST_REPORT_PDF_SIGNED_URL_TTL_SEC = 90 * 24 * 60 * 60; // 90 days

export async function createStudentTestReportPdfSignedUrl(
	storagePath: string | null | undefined,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
	if (!storagePath || typeof storagePath !== "string" || storagePath.trim() === "") {
		// Explicit guard: callers used to pass `null` from `test_reports.pdf_storage_path`
		// and Supabase would silently sign an empty path producing an unusable URL.
		// Surface this as a typed failure so the caller can decide (e.g., the
		// email job marks itself permanently failed instead of looping).
		return { ok: false, message: "Storage path is missing." };
	}
	const admin = createServiceRoleClient();
	const { data, error } = await admin.storage
		.from("student-test-reports")
		.createSignedUrl(storagePath, STUDENT_TEST_REPORT_PDF_SIGNED_URL_TTL_SEC);

	if (error || !data?.signedUrl) {
		return { ok: false, message: error?.message ?? "Could not create signed URL." };
	}
	return { ok: true, url: data.signedUrl };
}
