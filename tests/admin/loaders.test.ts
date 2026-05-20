import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
	parseAdminListPagination,
	parseAdminListQuery,
} from "@/lib/admin/loaders";

describe("D17: parseAdminListPagination", () => {
	it("uses defaults when no params", () => {
		const r = parseAdminListPagination(new URLSearchParams());
		expect(r).toEqual({ page: 1, pageSize: 25, offset: 0 });
	});

	it("parses page + page_size from URLSearchParams", () => {
		const r = parseAdminListPagination(
			new URLSearchParams({ page: "3", page_size: "10" }),
		);
		expect(r).toEqual({ page: 3, pageSize: 10, offset: 20 });
	});

	it("clamps page_size to maxPageSize", () => {
		const r = parseAdminListPagination(new URLSearchParams({ page_size: "9999" }));
		expect(r.pageSize).toBe(100);
	});

	it("clamps page_size minimum to 1", () => {
		const r = parseAdminListPagination(new URLSearchParams({ page_size: "-5" }));
		expect(r.pageSize).toBe(1);
	});

	it("accepts plain record (Next.js searchParams shape)", () => {
		const r = parseAdminListPagination({ page: "4", page_size: "12" });
		expect(r).toEqual({ page: 4, pageSize: 12, offset: 36 });
	});

	it("falls back to defaults on non-numeric input", () => {
		const r = parseAdminListPagination(new URLSearchParams({ page: "abc" }));
		expect(r.page).toBe(1);
	});

	it("respects custom defaultPageSize and maxPageSize", () => {
		const r = parseAdminListPagination(new URLSearchParams({ page_size: "300" }), {
			defaultPageSize: 50,
			maxPageSize: 200,
		});
		expect(r.pageSize).toBe(200);
	});
});

describe("D17: parseAdminListQuery", () => {
	const filtersSchema = z
		.object({
			q: z.string().optional(),
			status: z.enum(["draft", "sent"]).optional(),
		})
		.strict();

	it("parses pagination + typed filters", () => {
		const r = parseAdminListQuery(
			new URLSearchParams({ page: "2", page_size: "10", q: "test", status: "sent" }),
			filtersSchema,
		);
		expect(r.page).toBe(2);
		expect(r.pageSize).toBe(10);
		expect(r.offset).toBe(10);
		expect(r.filters.q).toBe("test");
		expect(r.filters.status).toBe("sent");
	});

	it("ignores unknown filter keys when schema is strict (safeParse falls back to empty)", () => {
		const r = parseAdminListQuery(
			new URLSearchParams({ unknown_filter: "foo" }),
			filtersSchema,
		);
		expect(r.filters).toEqual({});
	});

	it("does not leak page / page_size into filters", () => {
		const r = parseAdminListQuery(
			new URLSearchParams({ page: "1", page_size: "10", q: "abc" }),
			filtersSchema,
		);
		// Filters object should not contain pagination keys.
		expect(Object.keys(r.filters)).not.toContain("page");
		expect(Object.keys(r.filters)).not.toContain("page_size");
	});
});
