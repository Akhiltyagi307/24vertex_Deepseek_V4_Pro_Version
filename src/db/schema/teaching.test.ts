import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { assignmentQuestions } from "@/db/schema/teaching";

describe("assignmentQuestions schema", () => {
	it("exposes the columns the manual flow copies into questions", () => {
		const columns = Object.keys(getTableColumns(assignmentQuestions));
		expect(columns).toEqual(
			expect.arrayContaining([
				"id",
				"assignmentId",
				"questionNumber",
				"topicId",
				"questionType",
				"questionText",
				"options",
				"answerKey",
				"difficultyLevel",
				"metadata",
			]),
		);
	});
});
