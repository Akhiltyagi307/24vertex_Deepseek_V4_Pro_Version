import { renderToBuffer } from "@react-pdf/renderer";
import { z } from "zod";

import { getServerUser } from "@/lib/auth/get-server-user";
import {
	buildPracticeGradingReportPdfBuffer,
	uploadPracticeGradingReportPdf,
} from "@/lib/practice/ai-grade-practice-test";
import { contentDispositionWithFilename } from "@/lib/http/content-disposition";
import { logServerError, logSupabaseError } from "@/lib/server/log-supabase-error";
import { createClient } from "@/lib/supabase/server";
import { parseTestRow, type SubjectTestRowSerialized } from "@/lib/student/subject-test-report";
import { TestReportPdfDocument } from "@/lib/student/test-report-pdf-document";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ testId: string }> };

export async function GET(request: Request, context: RouteContext) {
	const { testId } = await context.params;
	if (!testId || !z.string().uuid().safeParse(testId).success) {
		return new Response("Missing or invalid test id", { status: 400 });
	}

	const url = new URL(request.url);
	const dispositionParam = url.searchParams.get("disposition");
	const inline =
		dispositionParam === "inline" ||
		url.searchParams.get("view") === "1" ||
		url.searchParams.get("inline") === "1";

	const user = await getServerUser();
	if (!user) {
		return new Response("Unauthorized", { status: 401 });
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
		return new Response("Not found", { status: 404 });
	}
	if (testRow.student_id !== user.id) {
		const { data: prof } = await supabase
			.from("profiles")
			.select("role")
			.eq("id", user.id)
			.maybeSingle();
		if (prof?.role === "parent") {
			const { data: link } = await supabase
				.from("parent_student_links")
				.select("student_id")
				.eq("parent_id", user.id)
				.eq("student_id", testRow.student_id as string)
				.eq("status", "active")
				.maybeSingle();
			if (!link) {
				return new Response("Forbidden", { status: 403 });
			}
		} else {
			return new Response("Forbidden", { status: 403 });
		}
	}

	const { data: subjectRow } = await supabase
		.from("subjects")
		.select("name")
		.eq("id", testRow.subject_id as string)
		.maybeSingle();

	const subjectName = subjectRow?.name?.trim() ? String(subjectRow.name) : "Subject";

	const { data: reportRow } = await supabase
		.from("test_reports")
		.select("id, pdf_storage_path")
		.eq("test_id", testId)
		.maybeSingle();

	const pdfPath = reportRow?.pdf_storage_path?.trim();
	if (pdfPath) {
		const { data: fileBlob, error: dlErr } = await supabase.storage
			.from("student-test-reports")
			.download(pdfPath);
		if (!dlErr && fileBlob) {
			const buf = await fileBlob.arrayBuffer();
			const short = testId.replace(/-/g, "").slice(0, 8);
			const filename = `24vertex-report-${short}.pdf`;
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
			logSupabaseError("StudentReportPdfRoute.storage.download", dlErr, { testId });
		}
	}

	// Rich practice report: (re)build the same PDF as the background job if Storage is empty or download failed.
	if (String(testRow.status) === "graded") {
		const built = await buildPracticeGradingReportPdfBuffer(testId);
		if (built.ok) {
			const up = await uploadPracticeGradingReportPdf(built.userId, testId, built.buffer);
			if (!up.ok) {
				logServerError("StudentReportPdfRoute.uploadPracticeGradingReportPdf", new Error(up.message), {
					testId,
				});
			}
			const short = testId.replace(/-/g, "").slice(0, 8);
			const filename = `24vertex-report-${short}.pdf`;
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
		const filename = `24vertex-report-${short}.pdf`;
		const contentDisposition = contentDispositionWithFilename(
			inline ? "inline" : "attachment",
			filename,
		);
		return new Response(new Uint8Array(buffer), {
			status: 200,
			headers: {
				"Content-Type": "application/pdf",
				"Content-Disposition": contentDisposition,
				"Cache-Control": "private, no-store",
			},
		});
	} catch (e) {
		logServerError("StudentReportPdfRoute.renderToBuffer", e, { testId });
		return new Response("Failed to generate PDF", { status: 500 });
	}
}
