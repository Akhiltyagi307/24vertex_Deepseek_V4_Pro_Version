import { describe, expect, it } from "vitest";

import { parseCsvWithHeader } from "@/lib/admin/import/csv-parser";
import { previewTopicCsvDiff } from "@/lib/admin/import/diff-preview";

describe("csv import diff", () => {
	it("round-trips topic keys for diff preview", () => {
		const csv = "topic_id,name\n11111111-1111-1111-1111-111111111111,Algebra\n";
		const { rows, errors } = parseCsvWithHeader<Record<string, string>>(csv);
		expect(errors.length).toBe(0);
		const existing = new Map<string, Record<string, string>>();
		existing.set("11111111-1111-1111-1111-111111111111", {
			topic_id: "11111111-1111-1111-1111-111111111111",
			name: "Algebra",
		});
		const diff = previewTopicCsvDiff("topic_id", rows, existing);
		expect(diff.every((d) => d.action === "skip")).toBe(true);
	});

	it("detects updates", () => {
		const rows = [{ topic_id: "11111111-1111-1111-1111-111111111111", name: "Geometry" }];
		const existing = new Map<string, Record<string, string>>();
		existing.set("11111111-1111-1111-1111-111111111111", {
			topic_id: "11111111-1111-1111-1111-111111111111",
			name: "Algebra",
		});
		const diff = previewTopicCsvDiff("topic_id", rows, existing);
		expect(diff[0]?.action).toBe("update");
	});
});
