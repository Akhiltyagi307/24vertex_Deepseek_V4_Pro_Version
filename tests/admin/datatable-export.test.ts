import { describe, expect, it } from "vitest";

import { escapeCsvCell, rowsToCsv } from "@/components/admin/data-table/admin-data-table-helpers";

describe("admin data table export", () => {
	it("escapes csv special characters", () => {
		expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
		expect(escapeCsvCell("a\nb")).toBe('"a\nb"');
	});

	it("builds csv with headers", () => {
		const csv = rowsToCsv(
			["name", "count"],
			[
				{ name: "A", count: 1 },
				{ name: "B,comma", count: 2 },
			],
		);
		expect(csv).toBe("name,count\nA,1\n\"B,comma\",2");
	});
});
