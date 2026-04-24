import {
	PracticeTestWizard,
	type PracticeEnrolledSubject,
	type PracticeSubjectProgress,
	type PracticeTestWizardProps,
} from "@/components/student/practice/practice-test-wizard";
import type { PerformanceRowSerialized } from "@/lib/student/performance-matrix";

export type StudentPracticeViewProps = {
	enrolledSubjects: PracticeEnrolledSubject[];
	performanceRows: PerformanceRowSerialized[];
	loadError: string | null;
	profileGrade: number | null;
	showPromptPreview: boolean;
	subjectProgressBySubjectId: Record<string, PracticeSubjectProgress>;
	isAdmin?: boolean;
};

export function StudentPracticeView({
	enrolledSubjects,
	performanceRows,
	loadError,
	profileGrade,
	showPromptPreview,
	subjectProgressBySubjectId,
	isAdmin,
}: StudentPracticeViewProps) {
	const wizardProps: PracticeTestWizardProps = {
		enrolledSubjects,
		performanceRows,
		loadError,
		profileGrade,
		showPromptPreview,
		subjectProgressBySubjectId,
		isAdmin: Boolean(isAdmin),
	};
	return <PracticeTestWizard {...wizardProps} />;
}
