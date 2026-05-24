import { describe, expect, it } from "vitest";

import { buildPracticeGradingPdfStudentDetailLines } from "@/lib/student/practice-grading-pdf-student-details";

describe("buildPracticeGradingPdfStudentDetailLines", () => {
	it("prioritizes roster fields and omits subject when cover title carries it", () => {
		const lines = buildPracticeGradingPdfStudentDetailLines(
			{
				fullName: "Aarav Mehta",
				grade: 11,
				section: "B",
				stream: "science_pcb",
				schoolName: "Sample School",
				electiveSubjectName: "Computer Science",
				studentLinkCode: "ABC123",
			},
			{
				testDateIso: "2026-05-20T10:00:00.000Z",
				createdAtIso: null,
				includeSubject: false,
				subjectName: "Physics",
			},
		);

		const labels = lines.map((l) => l.label);
		expect(labels).toEqual(["Grade", "Section", "School", "Link code", "Stream", "Elective", "Taken"]);
		expect(labels).not.toContain("Subject");
		expect(lines.find((l) => l.label === "Link code")?.tier).toBe("primary");
		expect(lines.find((l) => l.label === "Stream")?.tier).toBe("secondary");
	});

	it("can include subject when requested", () => {
		const lines = buildPracticeGradingPdfStudentDetailLines(
			{
				fullName: "Student",
				grade: null,
				section: null,
				stream: null,
				schoolName: null,
				electiveSubjectName: null,
				studentLinkCode: null,
			},
			{ subjectName: "Math", testDateIso: null, createdAtIso: null, includeSubject: true },
		);
		expect(lines.map((l) => l.label)).toEqual(["Subject"]);
	});
});
