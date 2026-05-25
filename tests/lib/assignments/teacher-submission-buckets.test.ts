import { describe, expect, it } from "vitest";

import {
	classifyTeacherSubmissionBucket,
	getWeakTopicsPreview,
	partitionTeacherSubmissionBundles,
} from "@/lib/assignments/teacher-submission-buckets";
import type { TeacherSubmissionAssignmentBundle } from "@/lib/assignments/teacher-submissions-hub-types";

const NOW = new Date("2026-05-25T12:00:00.000Z");

function bundle(
	overrides: Partial<Pick<TeacherSubmissionAssignmentBundle, "dueAt" | "counts">> & {
		topicAnalytics?: TeacherSubmissionAssignmentBundle["topicAnalytics"];
	},
): Pick<TeacherSubmissionAssignmentBundle, "dueAt" | "counts" | "topicAnalytics"> {
	return {
		dueAt: null,
		counts: { assigned: 1, submitted: 0, notSubmitted: 1 },
		topicAnalytics: [],
		...overrides,
	};
}

describe("classifyTeacherSubmissionBucket", () => {
	it("puts assignments due more than 7 days ago in past", () => {
		expect(
			classifyTeacherSubmissionBucket(
				bundle({
					dueAt: "2026-05-10T12:00:00.000Z",
					counts: { assigned: 5, submitted: 1, notSubmitted: 4 },
				}),
				NOW,
			),
		).toBe("past");
	});

	it("puts overdue within a week with missing students in completed", () => {
		expect(
			classifyTeacherSubmissionBucket(
				bundle({
					dueAt: "2026-05-20T12:00:00.000Z",
					counts: { assigned: 3, submitted: 1, notSubmitted: 2 },
				}),
				NOW,
			),
		).toBe("completed");
	});

	it("puts future due with missing students in ongoing", () => {
		expect(
			classifyTeacherSubmissionBucket(
				bundle({
					dueAt: "2026-05-31T12:00:00.000Z",
					counts: { assigned: 2, submitted: 0, notSubmitted: 2 },
				}),
				NOW,
			),
		).toBe("ongoing");
	});

	it("puts all handed in before due in completed", () => {
		expect(
			classifyTeacherSubmissionBucket(
				bundle({
					dueAt: "2026-06-01T12:00:00.000Z",
					counts: { assigned: 4, submitted: 4, notSubmitted: 0 },
				}),
				NOW,
			),
		).toBe("completed");
	});

	it("puts no due date with outstanding hand-ins in ongoing", () => {
		expect(
			classifyTeacherSubmissionBucket(
				bundle({
					dueAt: null,
					counts: { assigned: 1, submitted: 0, notSubmitted: 1 },
				}),
				NOW,
			),
		).toBe("ongoing");
	});

	it("puts no due date with everyone handed in in completed", () => {
		expect(
			classifyTeacherSubmissionBucket(
				bundle({
					dueAt: null,
					counts: { assigned: 2, submitted: 2, notSubmitted: 0 },
				}),
				NOW,
			),
		).toBe("completed");
	});

	it("puts zero assigned with no due in completed", () => {
		expect(
			classifyTeacherSubmissionBucket(
				bundle({
					dueAt: null,
					counts: { assigned: 0, submitted: 0, notSubmitted: 0 },
				}),
				NOW,
			),
		).toBe("completed");
	});
});

describe("partitionTeacherSubmissionBundles", () => {
	it("partitions bundles into disjoint buckets", () => {
		const bundles = [
			{
				assignmentId: "a",
				title: "A",
				dueAt: "2026-05-10T12:00:00.000Z",
				createdAt: null,
				subjectName: null,
				subjectGrade: null,
				sectionsLabel: "",
				submissions: [],
				counts: { assigned: 1, submitted: 0, notSubmitted: 1 },
				topicAnalytics: [],
				studentsPerformance: [],
			},
			{
				assignmentId: "b",
				title: "B",
				dueAt: "2026-05-31T12:00:00.000Z",
				createdAt: null,
				subjectName: null,
				subjectGrade: null,
				sectionsLabel: "",
				submissions: [],
				counts: { assigned: 1, submitted: 0, notSubmitted: 1 },
				topicAnalytics: [],
				studentsPerformance: [],
			},
		] satisfies TeacherSubmissionAssignmentBundle[];

		const parts = partitionTeacherSubmissionBundles(bundles, NOW);
		expect(parts.past).toHaveLength(1);
		expect(parts.past[0]?.assignmentId).toBe("a");
		expect(parts.ongoing).toHaveLength(1);
		expect(parts.ongoing[0]?.assignmentId).toBe("b");
		expect(parts.completed).toHaveLength(0);
	});
});

describe("getWeakTopicsPreview", () => {
	it("sorts by badCount then lowest cumulative percent", () => {
		const preview = getWeakTopicsPreview({
			topicAnalytics: [
				{
					topicId: "1",
					topicName: "Low bad",
					cumulativePercent: 40,
					badCount: 1,
					satisfactoryCount: 0,
					goodCount: 0,
					sampleStudents: 2,
					badStudents: [],
					satisfactoryStudents: [],
					goodStudents: [],
				},
				{
					topicId: "2",
					topicName: "High bad",
					cumulativePercent: 60,
					badCount: 3,
					satisfactoryCount: 0,
					goodCount: 0,
					sampleStudents: 2,
					badStudents: [],
					satisfactoryStudents: [],
					goodStudents: [],
				},
				{
					topicId: "3",
					topicName: "No samples",
					cumulativePercent: 10,
					badCount: 5,
					satisfactoryCount: 0,
					goodCount: 0,
					sampleStudents: 0,
					badStudents: [],
					satisfactoryStudents: [],
					goodStudents: [],
				},
			],
		});
		expect(preview.map((r) => r.topicId)).toEqual(["2", "1"]);
	});
});
