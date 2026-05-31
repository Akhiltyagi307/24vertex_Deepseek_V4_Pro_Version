import { describe, expect, it } from "vitest";

import { resolveFocusTopics } from "./teacher-at-risk-intervention";
import type { StudentWeakTopic } from "./teacher-student-weak-topics-queries";

function topic(id: string): StudentWeakTopic {
	return { topicId: id, topicName: id.toUpperCase(), averagePercent: 50, testsTaken: 1 };
}

describe("resolveFocusTopics", () => {
	const weakTopics = [topic("a"), topic("b"), topic("c"), topic("d")];

	it("maps 1-based picks to topics, preserving pick order and dropping dups/out-of-range", () => {
		expect(resolveFocusTopics(weakTopics, [2, 2, 99, 1]).map((t) => t.topicId)).toEqual(["b", "a"]);
	});

	it("falls back to the weakest few when no pick is valid", () => {
		expect(resolveFocusTopics(weakTopics, [99, 0, -1]).map((t) => t.topicId)).toEqual([
			"a",
			"b",
			"c",
			"d",
		]);
	});

	it("falls back when the model returns an empty list", () => {
		expect(resolveFocusTopics(weakTopics, []).map((t) => t.topicId)).toEqual(["a", "b", "c", "d"]);
	});

	it("never exceeds the available weak topics in fallback", () => {
		expect(resolveFocusTopics([topic("only")], []).map((t) => t.topicId)).toEqual(["only"]);
	});
});
