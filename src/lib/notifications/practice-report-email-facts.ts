import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { subjects } from "@/db/schema/academic";
import { testReports, tests } from "@/db/schema/assessment";
import { logServerError } from "@/lib/server/log-supabase-error";
import { canonicalPracticeReportPdfStoragePath } from "@/lib/notifications/practice-report-pdf-path";

export type ResolvePracticeReportEmailFactsInput = {
	testId: string;
	studentId: string;
	/** Job payload (telemetry only). */
	payloadSubjectName?: string | null;
	payloadStoragePath?: string | null;
};

export type ResolvedPracticeReportEmailFacts =
	| {
			ok: true;
			subjectName: string;
			overallPercent: number | null;
			submittedAtIso: string | null;
			storagePath: string;
	  }
	| { ok: false; reason: string };

function overallPercentFromSummary(summaryReport: unknown): number | null {
	const sr = summaryReport as { overall_percent?: unknown } | null | undefined;
	if (typeof sr?.overall_percent === "number" && Number.isFinite(sr.overall_percent)) {
		return sr.overall_percent;
	}
	return null;
}

/**
 * Loads authoritative subject, score, submit time, and PDF path for transactional
 * report-ready email. Queue payloads are ignored for display/signing so delayed
 * jobs cannot ship another subject line or signed PDF key from stale JSON.
 */
export async function resolvePracticeReportEmailFacts(
	input: ResolvePracticeReportEmailFactsInput,
): Promise<ResolvedPracticeReportEmailFacts> {
	try {
		const rows = await db
			.select({
				ownerStudentId: tests.studentId,
				subjectName: subjects.name,
				testDate: tests.testDate,
				totalScore: tests.totalScore,
				summaryReport: testReports.summaryReport,
				dbPdfPath: testReports.pdfStoragePath,
			})
			.from(tests)
			.innerJoin(subjects, eq(subjects.id, tests.subjectId))
			.leftJoin(testReports, eq(testReports.testId, tests.id))
			.where(eq(tests.id, input.testId))
			.limit(1);

		const row = rows[0];
		if (!row) {
			return { ok: false, reason: "test_not_found" };
		}
		if (row.ownerStudentId !== input.studentId) {
			logServerError("practice_report_email_facts.student_mismatch", new Error("owner mismatch"), {
				testId: input.testId,
				expectedStudentId: input.studentId,
				actualStudentId: row.ownerStudentId,
			});
			return { ok: false, reason: "student_test_mismatch" };
		}

		const subjectName = String(row.subjectName ?? "Subject").trim() || "Subject";
		let overallPercent = overallPercentFromSummary(row.summaryReport);
		if (overallPercent == null && row.totalScore != null) {
			const n = Number.parseFloat(String(row.totalScore));
			if (Number.isFinite(n)) overallPercent = n;
		}

		const submittedAtIso =
			row.testDate instanceof Date ? row.testDate.toISOString()
			: row.testDate ? new Date(row.testDate as unknown as string).toISOString()
			: null;

		const canonical = canonicalPracticeReportPdfStoragePath(input.studentId, input.testId);
		const dbPath = row.dbPdfPath?.trim() || null;
		let storagePath = canonical;
		if (
			dbPath &&
			(dbPath === canonical ||
				(dbPath.startsWith(`${input.studentId}/`) && dbPath.endsWith(`${input.testId}.pdf`)))
		) {
			storagePath = dbPath;
		} else if (dbPath && dbPath !== canonical) {
			logServerError("practice_report_email_facts.pdf_path_invalid", new Error("unexpected pdf path"), {
				testId: input.testId,
				studentId: input.studentId,
				dbPdfPath: dbPath,
				fallbackPath: canonical,
			});
		}

		const paySub = input.payloadSubjectName?.trim();
		if (paySub && paySub !== subjectName) {
			logServerError("practice_report_email_facts.subject_payload_drift", new Error("subject mismatch"), {
				testId: input.testId,
				studentId: input.studentId,
				payloadSubjectName: paySub,
				resolvedSubjectName: subjectName,
			});
		}

		const payPath = input.payloadStoragePath?.trim();
		if (payPath && payPath !== storagePath) {
			logServerError("practice_report_email_facts.storage_payload_drift", new Error("storage path mismatch"), {
				testId: input.testId,
				studentId: input.studentId,
				payloadStoragePath: payPath,
				resolvedStoragePath: storagePath,
			});
		}

		return {
			ok: true,
			subjectName,
			overallPercent,
			submittedAtIso,
			storagePath,
		};
	} catch (err) {
		logServerError("practice_report_email_facts.db", err, {
			testId: input.testId,
			studentId: input.studentId,
		});
		return { ok: false, reason: err instanceof Error ? err.message : "db_error" };
	}
}
