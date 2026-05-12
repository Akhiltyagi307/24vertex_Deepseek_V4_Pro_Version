/** Matches `uploadPracticeGradingReportPdf` — canonical Storage object key for a graded practice PDF. */
export function canonicalPracticeReportPdfStoragePath(studentId: string, testId: string): string {
	return `${studentId}/${testId}.pdf`;
}
