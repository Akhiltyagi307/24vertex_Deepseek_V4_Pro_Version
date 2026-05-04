import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";

/** Long-lived link for email recipients; no EduAI login required (Supabase token in URL). */
export const STUDENT_TEST_REPORT_PDF_SIGNED_URL_TTL_SEC = 90 * 24 * 60 * 60; // 90 days

export async function createStudentTestReportPdfSignedUrl(
	storagePath: string,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
	const admin = createServiceRoleClient();
	const { data, error } = await admin.storage
		.from("student-test-reports")
		.createSignedUrl(storagePath, STUDENT_TEST_REPORT_PDF_SIGNED_URL_TTL_SEC);

	if (error || !data?.signedUrl) {
		return { ok: false, message: error?.message ?? "Could not create signed URL." };
	}
	return { ok: true, url: data.signedUrl };
}
