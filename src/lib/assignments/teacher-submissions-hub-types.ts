import type { TrackerTopicStatus } from "@/lib/practice/topic-rollup";

import type { TeacherAssignmentSubmissionRow } from "./queries";

export type TopicSubmissionAggRow = {
	topicId: string;
	topicName: string;
	cumulativePercent: number | null;
	badCount: number;
	satisfactoryCount: number;
	goodCount: number;
	sampleStudents: number;
};

export type StudentSubmissionPerfRow = {
	studentId: string;
	studentFullName: string;
	studentGrade: number | null;
	studentSection: string | null;
	lifecycleStatus: string;
	scorePercent: number | null;
	testId: string | null;
	previewOverallPercent: number | null;
	previewTopics: Array<{ topicName: string; averagePercent: number; status: TrackerTopicStatus }>;
};

export type TeacherSubmissionAssignmentBundle = {
	assignmentId: string;
	title: string;
	dueAt: string | null;
	createdAt: string | null;
	subjectName: string | null;
	subjectGrade: number | null;
	sectionsLabel: string;
	submissions: TeacherAssignmentSubmissionRow[];
	counts: {
		assigned: number;
		submitted: number;
		notSubmitted: number;
	};
	topicAnalytics: TopicSubmissionAggRow[];
	studentsPerformance: StudentSubmissionPerfRow[];
};
