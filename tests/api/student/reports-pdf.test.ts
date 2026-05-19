/**
 * Audit D33: lock down the React-PDF render path for the student
 * `/api/student/reports/[testId]/pdf` route. We don't drive the route handler
 * (it needs Supabase auth, RLS, and access to the AI-graded report blob);
 * instead we render the same `TestReportPdfDocument` the route uses with a
 * fixed input and assert the rendered buffer starts with `%PDF-` and exceeds
 * a sensible minimum size. Catches:
 *
 *  - React-PDF runtime regressions (font registration, StyleSheet, etc.).
 *  - Document tree changes that throw at render time but pass typecheck.
 *  - Empty-buffer regressions (a previous incident where Helvetica-Bold was
 *    referenced before font registration shipped 0-byte PDFs to users).
 */
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";

import type { SubjectTestRowSerialized } from "@/lib/student/subject-test-report";
import { TestReportPdfDocument } from "@/lib/student/test-report-pdf-document";

const sampleTest: SubjectTestRowSerialized = {
	id: "11111111-1111-1111-1111-111111111111",
	testDate: "2026-05-19T09:30:00.000Z",
	testType: "self",
	status: "graded",
	totalScore: "84",
	totalQuestions: 25,
	correctAnswers: 21,
	unitName: "Linear Algebra",
	difficulty: "medium",
	durationSeconds: 1800,
	isDraft: false,
	createdAt: "2026-05-19T09:00:00.000Z",
};

describe("TestReportPdfDocument render", () => {
	it("renders a non-trivial PDF buffer for a graded test row", async () => {
		const element = TestReportPdfDocument({
			subjectName: "Mathematics",
			test: sampleTest,
			hasAiReport: true,
		});
		// `TestReportPdfDocument` returns a JSX `<Document>` element; React-PDF's
		// `renderToBuffer` accepts that directly.
		const buf = await renderToBuffer(element);
		expect(buf).toBeInstanceOf(Buffer);
		expect(buf.byteLength).toBeGreaterThan(1024);
		// Real PDFs start with the magic bytes `%PDF-`.
		expect(buf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
	}, 15_000);

	it("renders even when totalQuestions is null (no quiz scoring yet)", async () => {
		const element = TestReportPdfDocument({
			subjectName: "Mathematics",
			test: { ...sampleTest, totalQuestions: null, correctAnswers: null, totalScore: null },
			hasAiReport: false,
		});
		const buf = await renderToBuffer(element);
		expect(buf.byteLength).toBeGreaterThan(1024);
		expect(buf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
	}, 15_000);
});
