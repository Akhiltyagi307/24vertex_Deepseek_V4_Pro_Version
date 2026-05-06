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
	showPromptPreview: boolean;
	subjectProgressBySubjectId: Record<string, PracticeSubjectProgress>;
	isAdmin?: boolean;
	userId: string;
};

export function StudentPracticeView({
	enrolledSubjects,
	performanceRows,
	loadError,
	showPromptPreview,
	subjectProgressBySubjectId,
	isAdmin,
	userId,
}: StudentPracticeViewProps) {
	const wizardProps: PracticeTestWizardProps = {
		enrolledSubjects,
		performanceRows,
		loadError,
		showPromptPreview,
		subjectProgressBySubjectId,
		isAdmin: Boolean(isAdmin),
		userId,
	};
	return <PracticeTestWizard {...wizardProps} />;
}
