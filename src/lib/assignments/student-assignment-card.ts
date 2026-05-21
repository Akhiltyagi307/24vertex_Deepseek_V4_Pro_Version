export type StudentAssignmentCard = {
	id: string;
	assignmentId: string;
	title: string;
	instructions: string | null;
	lifecycleStatus: string;
	testId: string | null;
	score: string | null;
	dueAt: string | null;
	createdAt: string | null;
	submittedAt: string | null;
	gradedAt: string | null;
	subjectName: string | null;
};
