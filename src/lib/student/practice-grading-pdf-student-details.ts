import { formatStreamLabel } from "@/lib/academic/stream-labels";
import { formatDateTimeMediumShortInAppTimeZone } from "@/lib/datetime/app-timezone";

/** Student identity fields loaded for the practice report cover (teacher-facing). */
export type PracticeGradingPdfStudentDetails = {
	fullName: string | null;
	grade: number | null;
	section: string | null;
	stream: string | null;
	schoolName: string | null;
	electiveSubjectName: string | null;
	studentLinkCode: string | null;
};

export type PracticeGradingPdfStudentDetailTier = "primary" | "secondary";

export type PracticeGradingPdfStudentDetailLine = {
	label: string;
	value: string;
	tier: PracticeGradingPdfStudentDetailTier;
};

function formatTestDate(iso: string | null | undefined): string | null {
	if (!iso) return null;
	try {
		return formatDateTimeMediumShortInAppTimeZone(iso);
	} catch {
		return null;
	}
}

export type BuildPracticeGradingPdfStudentDetailLinesOpts = {
	testDateIso: string | null;
	createdAtIso: string | null;
	/** Omit subject row when the cover title already names the subject. */
	includeSubject?: boolean;
	subjectName?: string;
};

/**
 * Ordered label/value rows for the cover hero student block.
 * Primary rows: roster lookup. Secondary: syllabus context.
 */
export function buildPracticeGradingPdfStudentDetailLines(
	details: PracticeGradingPdfStudentDetails,
	opts: BuildPracticeGradingPdfStudentDetailLinesOpts,
): PracticeGradingPdfStudentDetailLine[] {
	const lines: PracticeGradingPdfStudentDetailLine[] = [];

	if (details.grade != null && Number.isFinite(details.grade)) {
		lines.push({ label: "Grade", value: `Class ${details.grade}`, tier: "primary" });
	}

	const section = details.section?.trim();
	if (section) {
		lines.push({ label: "Section", value: section, tier: "primary" });
	}

	const school = details.schoolName?.trim();
	if (school) {
		lines.push({ label: "School", value: school, tier: "primary" });
	}

	const linkCode = details.studentLinkCode?.trim();
	if (linkCode) {
		lines.push({ label: "Link code", value: linkCode, tier: "primary" });
	}

	const stream = formatStreamLabel(details.stream);
	if (stream) {
		lines.push({ label: "Stream", value: stream, tier: "secondary" });
	}

	if (opts.includeSubject) {
		const subject = opts.subjectName?.trim();
		if (subject) {
			lines.push({ label: "Subject", value: subject, tier: "secondary" });
		}
	}

	const elective = details.electiveSubjectName?.trim();
	if (elective) {
		lines.push({ label: "Elective", value: elective, tier: "secondary" });
	}

	const testDate = formatTestDate(opts.testDateIso ?? opts.createdAtIso);
	if (testDate) {
		lines.push({ label: "Taken", value: testDate, tier: "secondary" });
	}

	return lines;
}

export function practiceGradingPdfStudentDisplayName(details: PracticeGradingPdfStudentDetails): string | null {
	const name = details.fullName?.trim();
	return name || null;
}
