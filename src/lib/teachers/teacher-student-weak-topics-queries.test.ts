import { describe, expect, it } from "vitest";

import { selectInterventionTarget } from "./teacher-student-weak-topics-queries";

type Row = Parameters<typeof selectInterventionTarget>[0][number];

function row(over: Partial<Row> = {}): Row {
	return {
		subjectId: "s1",
		subjectName: "Math",
		topicId: "t",
		topicName: "T",
		averagePercent: 50,
		testsTaken: 2,
		...over,
	};
}

describe("selectInterventionTarget", () => {
	it("returns null when no topic is below the support line", () => {
		expect(
			selectInterventionTarget([
				row({ topicId: "a", averagePercent: 75 }),
				row({ topicId: "b", averagePercent: 90 }),
			]),
		).toBeNull();
	});

	it("keeps only below-support topics, weakest first", () => {
		const target = selectInterventionTarget([
			row({ topicId: "a", topicName: "Algebra", averagePercent: 58 }),
			row({ topicId: "b", topicName: "Fractions", averagePercent: 40 }),
			row({ topicId: "c", topicName: "Geometry", averagePercent: 72 }),
		]);
		expect(target?.subjectId).toBe("s1");
		expect(target?.topics.map((topic) => topic.topicId)).toEqual(["b", "a"]);
	});

	it("targets the subject with the most below-support topics", () => {
		const target = selectInterventionTarget([
			row({ subjectId: "math", subjectName: "Math", topicId: "m1", averagePercent: 55 }),
			row({ subjectId: "sci", subjectName: "Science", topicId: "s1", averagePercent: 30 }),
			row({ subjectId: "sci", subjectName: "Science", topicId: "s2", averagePercent: 45 }),
		]);
		expect(target?.subjectId).toBe("sci");
		expect(target?.topics).toHaveLength(2);
	});

	it("respects a forced subject even when another subject is weaker", () => {
		const target = selectInterventionTarget(
			[
				row({ subjectId: "math", subjectName: "Math", topicId: "m1", averagePercent: 59 }),
				row({ subjectId: "sci", subjectName: "Science", topicId: "s1", averagePercent: 20 }),
			],
			{ forcedSubjectId: "math" },
		);
		expect(target?.subjectId).toBe("math");
		expect(target?.topics.map((topic) => topic.topicId)).toEqual(["m1"]);
	});

	it("caps the topic list at the requested limit", () => {
		const rows = Array.from({ length: 12 }, (_, index) =>
			row({ topicId: `t${index}`, averagePercent: 10 + index }),
		);
		const target = selectInterventionTarget(rows, { limit: 8 });
		expect(target?.topics).toHaveLength(8);
	});
});
