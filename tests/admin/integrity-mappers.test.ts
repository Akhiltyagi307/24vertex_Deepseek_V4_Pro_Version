import { describe, expect, it } from "vitest";

import {
	parseIntegrityRows,
	studentMissingTrackerSchema,
	subscriptionWithoutPlanSchema,
	trackerRowSchema,
} from "@/lib/admin/integrity/mappers";

describe("D19: integrity check mapper layer", () => {
	it("parses well-formed rows into typed objects (no `as unknown as` casts)", () => {
		const r = parseIntegrityRows(
			[{ student_id: "abc-123" }, { student_id: "def-456" }],
			studentMissingTrackerSchema,
		);
		expect(r.rows).toHaveLength(2);
		expect(r.parsed).toBe(2);
		expect(r.dropped).toBe(0);
		expect(r.rows[0]?.student_id).toBe("abc-123");
	});

	it("drops malformed rows but keeps good ones — count surfaces investigation", () => {
		const r = parseIntegrityRows(
			[{ student_id: "good" }, { wrong: "shape" }, { student_id: 123 }],
			studentMissingTrackerSchema,
		);
		expect(r.parsed).toBe(1);
		expect(r.dropped).toBe(2);
		expect(r.rows[0]?.student_id).toBe("good");
	});

	it("accepts iterables (Drizzle execute() result wrappers)", () => {
		const iter: Iterable<unknown> = {
			[Symbol.iterator]() {
				return [{ subscription_id: "sub-1", plan_code: "pro" }][Symbol.iterator]();
			},
		};
		const r = parseIntegrityRows(iter, subscriptionWithoutPlanSchema);
		expect(r.rows).toHaveLength(1);
	});

	it("returns empty when input isn't iterable", () => {
		const r = parseIntegrityRows(null, trackerRowSchema);
		expect(r.rows).toHaveLength(0);
	});

	it("passthrough() keeps extra projected columns visible to the audit log", () => {
		const r = parseIntegrityRows(
			[
				{
					tracker_row_id: "t1",
					student_id: "s1",
					topic_id: "to1",
					extra_diagnostic: "drift",
				},
			],
			trackerRowSchema,
		);
		expect(r.rows[0]).toMatchObject({
			tracker_row_id: "t1",
			extra_diagnostic: "drift",
		});
	});
});
