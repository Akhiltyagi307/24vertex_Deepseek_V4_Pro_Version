import { describe, expect, it } from "vitest";

import { dominantStatusFromTrackerStats } from "@/lib/student/performance-matrix";
import {
	formatTrackerStatusFromRaw,
	formatTrackerStatusLabel,
	subjectStatusLabelRank,
	TRACKER_STATUS_LABELS,
} from "@/lib/student/tracker-status-labels";

describe("tracker-status-labels", () => {
	it("maps slugs to Set 3 labels", () => {
		expect(formatTrackerStatusLabel("good")).toBe("Strong");
		expect(formatTrackerStatusLabel("satisfactory")).toBe("On track");
		expect(formatTrackerStatusLabel("bad")).toBe("Strengthen");
		expect(formatTrackerStatusLabel("not_tested")).toBe("Not tested");
	});

	it("formats raw slugs and legacy title-case labels", () => {
		expect(formatTrackerStatusFromRaw("good")).toBe("Strong");
		expect(formatTrackerStatusFromRaw("Good")).toBe("Strong");
		expect(formatTrackerStatusFromRaw("Satisfactory")).toBe("On track");
	});

	it("ranks strengthen before on track before strong", () => {
		expect(subjectStatusLabelRank("Strengthen")).toBeLessThan(subjectStatusLabelRank("On track"));
		expect(subjectStatusLabelRank("On track")).toBeLessThan(subjectStatusLabelRank("Strong"));
	});

	it("dominant subject label uses Set 3 vocabulary", () => {
		expect(
			dominantStatusFromTrackerStats({
				trackedCount: 3,
				good: 2,
				satisfactory: 1,
				bad: 0,
				notTested: 0,
				lastTestDate: null,
				testsTakenTotal: 3,
			}),
		).toBe(TRACKER_STATUS_LABELS.good);
	});
});
