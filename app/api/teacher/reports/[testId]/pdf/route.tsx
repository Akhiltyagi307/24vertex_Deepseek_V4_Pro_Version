import { renderToBuffer } from "@react-pdf/renderer";
import { z } from "zod";

import { teacherOwnsAssignmentTest } from "@/lib/assignments/teacher-submissions-hub";
import { getVerifiedTeacherSession } from "@/lib/auth/require-verified-teacher";
import {
	buildPracticeGradingReportPdfBuffer,
	uploadPracticeGradingReportPdf,
} from "@/lib/practice/ai-grade-practice-test";
import { contentDispositionWithFilename } from "@/lib/http/content-disposition";
import { logServerError, logSupabaseError } from "@/lib/server/log-supabase-error";
import { createClient } from "@/lib/supabase/server";
import { withTeacherActionTelemetry } from "@/lib/teachers/teacher-action-observability";
import { logTeacherReportPdfOutcome } from "@/lib/teachers/teacher-report-pdf-audit-log";
import { consumeTeacherReportPdfRateLimit } from "@/lib/teachers/teacher-report-pdf-rate-limit";
import { parseTestRow, type SubjectTestRowSerialized } from "@/lib/student/subject-test-report";
import { TestReportPdfDocument } from "@/lib/student/test-report-pdf-document";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ testId: string }> };

export async function GET(request: Request, context: RouteContext) {
	return withTeacherActionTelemetry("teacherReportPdfRoute", async (breadcrumb) => {
	const { testId } = await context.params;
	if (!testId || !z.string().uuid().safeParse(testId).success) {
		breadcrumb("invalid_test_id");
		logTeacherReportPdfOutcome({
			outcome: "invalid_test_id",
			status: 400,
			testId: testId || undefined,
		});
		return new Response("Missing or invalid test id", { status: 400 });
	}

	const url = new URL(request.url);
	const dispositionParam = url.searchParams.get("disposition");
	const inline =
		dispositionParam === "inline" ||
		url.searchParams.get("view") === "1" ||
		url.searchParams.get("inline") === "1";

	const session = await getVerifiedTeacherSession();
	if (!session.ok) {
		logTeacherReportPdfOutcome({
			outcome: session.status === 401 ? "unauthorized" : "forbidden_not_teacher",
			status: session.status,
			userId: session.userId,
			testId,
		});
		return new Response(session.status === 401 ? "Unauthorized" : "Forbidden", { status: session.status });
	}
	const { user } = session;

	const rate = await consumeTeacherReportPdfRateLimit(user.id);
	if (!rate.ok) {
		logTeacherReportPdfOutcome({
			outcome: rate.status === 503 ? "rate_limit_service_unavailable" : "rate_limited",
			status: rate.status,
			userId: user.id,
			testId,
		});
		return rate.response;
	}

	const allowed = await teacherOwnsAssignmentTest(user.id, testId);
	if (!allowed) {
		logTeacherReportPdfOutcome({
			outcome: "forbidden_not_owner",
			status: 403,
			userId: user.id,
			testId,
		});
		return new Response("Forbidden", { status: 403 });
	}

	const supabase = await createClient();

	const { data: testRow, error: testErr } = await supabase
		.from("tests")
		.select(
			"id, student_id, subject_id, unit_name, test_type, test_date, duration_seconds, status, total_score, total_questions, correct_answers, is_draft, difficulty, created_at",
		)
		.eq("id", testId)
		.maybeSingle();

	if (testErr || !testRow) {
		if (testErr) {
			logSupabaseError("TeacherReportPdfRoute.tests.select", testErr, { testId });
		}
		logTeacherReportPdfOutcome({
			outcome: "not_found_test",
			status: 404,
			userId: user.id,
			testId,
		});
		return new Response("Not found", { status: 404 });
	}

	const subjectRowPromise = supabase
		.from("subjects")
		.select("name")
		.eq("id", testRow.subject_id as string)
		.maybeSingle();

	const reportRowPromise = supabase
		.from("test_reports")
		.select("id, pdf_storage_path")
		.eq("test_id", testId)
		.maybeSingle();

	const [{ data: subjectRow }, { data: reportRow }] = await Promise.all([subjectRowPromise, reportRowPromise]);
	const subjectName = subjectRow?.name?.trim() ? String(subjectRow.name) : "Subject";

	const pdfPath = reportRow?.pdf_storage_path?.trim();
	if (pdfPath) {
		const { data: fileBlob, error: dlErr } = await supabase.storage
			.from("student-test-reports")
			.download(pdfPath);
		if (!dlErr && fileBlob) {
			const buf = await fileBlob.arrayBuffer();
			const short = testId.replace(/-/g, "").slice(0, 8);
			const filename = `eduai-report-${short}.pdf`;
			const contentDisposition = contentDispositionWithFilename(
				inline ? "inline" : "attachment",
				filename,
			);
			return new Response(buf, {
				status: 200,
				headers: {
					"Content-Type": "application/pdf",
					"Content-Disposition": contentDisposition,
					"Cache-Control": "private, no-store",
				},
			});
		}
		if (dlErr) {
			logSupabaseError("TeacherReportPdfRoute.storage.download", dlErr, { testId });
		}
	}

	if (String(testRow.status) === "graded") {
		const built = await buildPracticeGradingReportPdfBuffer(testId);
		if (built.ok) {
			const up = await uploadPracticeGradingReportPdf(built.userId, testId, built.buffer);
			if (!up.ok) {
				logServerError("TeacherReportPdfRoute.uploadPracticeGradingReportPdf", new Error(up.message), {
					testId,
				});
			}
			const short = testId.replace(/-/g, "").slice(0, 8);
			const filename = `eduai-report-${short}.pdf`;
			const contentDisposition = contentDispositionWithFilename(
				inline ? "inline" : "attachment",
				filename,
			);
			return new Response(new Uint8Array(built.buffer), {
				status: 200,
				headers: {
					"Content-Type": "application/pdf",
					"Content-Disposition": contentDisposition,
					"Cache-Control": "private, no-store",
				},
			});
		}
	}

	const test = parseTestRow(testRow as Record<string, unknown>) as SubjectTestRowSerialized;

	try {
		const buffer = await renderToBuffer(
			<TestReportPdfDocument subjectName={subjectName} test={test} hasAiReport={Boolean(reportRow)} />,
		);
		const short = testId.replace(/-/g, "").slice(0, 8);
		const filename = `eduai-report-${short}.pdf`;
		const contentDisposition = contentDispositionWithFilename(
			inline ? "inline" : "attachment",
			filename,
		);
		breadcrumb("pdf_rendered_inline");
		return new Response(new Uint8Array(buffer), {
			status: 200,
			headers: {
				"Content-Type": "application/pdf",
				"Content-Disposition": contentDisposition,
				"Cache-Control": "private, no-store",
			},
		});
	} catch (e) {
		breadcrumb("pdf_render_failed");
		logServerError("TeacherReportPdfRoute.renderToBuffer", e, { testId });
		return new Response("Failed to generate PDF", { status: 500 });
	}
	});
}
