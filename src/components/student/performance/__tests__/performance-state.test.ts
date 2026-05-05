import { describe, expect, it } from "vitest";

import type { PerformanceRowSerialized } from "@/lib/student/performance-matrix";
import {
	activePerformanceFilterCount,
	hasActiveLocalFilters,
	initialPerformanceState,
	performanceReducer,
	performanceSortIsNonDefault,
} from "@/components/student/performance/performance-state";

const ROW: PerformanceRowSerialized = {
	trackerId: "tr1",
	topicId: "t1",
	subjectId: "s1",
	status: "satisfactory",
	lastTestDate: null,
	averageScore: 55,
	testsTaken: 2,
	trend: "stable",
	updatedAt: "2025-01-01T00:00:00Z",
	topicName: "Algebra",
	unitName: "Numbers",
	unitNumber: 1,
	chapterName: "Chapter 1",
	chapterNumber: 1,
	topicNumber: 1,
	grade: 9,
	subjectName: "Mathematics",
	subjectGroup: null,
	subjectSortOrder: 0,
};

describe("performanceReducer — filters", () => {
	it("set_status_filter updates value", () => {
		const next = performanceReducer(initialPerformanceState, {
			type: "set_status_filter",
			value: "good",
		});
		expect(next.statusFilter).toBe("good");
	});

	it("set_status_filter is a no-op when value is already set", () => {
		const next = performanceReducer(initialPerformanceState, {
			type: "set_status_filter",
			value: "all",
		});
		expect(next).toBe(initialPerformanceState);
	});

	it("set_sort_mode updates value", () => {
		const next = performanceReducer(initialPerformanceState, {
			type: "set_sort_mode",
			value: "last_test",
		});
		expect(next.sortMode).toBe("last_test");
	});

	it("set_topic_search updates value and trims-aware predicates flip", () => {
		const next = performanceReducer(initialPerformanceState, {
			type: "set_topic_search",
			value: "alg",
		});
		expect(next.topicSearch).toBe("alg");
		expect(hasActiveLocalFilters(next)).toBe(true);
	});

	it("reset_local_filters wipes status, sort, and search but preserves selection / sheet / popovers", () => {
		const dirty = {
			...initialPerformanceState,
			statusFilter: "bad" as const,
			sortMode: "last_test" as const,
			topicSearch: "alg",
			selectedTopicIds: new Set(["t1", "t2"]),
			sheetRow: ROW,
			sheetOpen: true,
			summaryOpen: false,
			filtersPopoverOpen: true,
			sortPopoverOpen: false,
		};
		const next = performanceReducer(dirty, { type: "reset_local_filters" });
		expect(next.statusFilter).toBe("all");
		expect(next.sortMode).toBe("curriculum");
		expect(next.topicSearch).toBe("");
		expect(next.selectedTopicIds).toBe(dirty.selectedTopicIds);
		expect(next.sheetRow).toBe(ROW);
		expect(next.sheetOpen).toBe(true);
		expect(next.summaryOpen).toBe(false);
		expect(next.filtersPopoverOpen).toBe(true);
	});
});

describe("performanceReducer — selection", () => {
	it("toggle_topic adds when checked, removes when unchecked", () => {
		const a = performanceReducer(initialPerformanceState, {
			type: "toggle_topic",
			id: "t1",
			checked: true,
		});
		expect(a.selectedTopicIds.has("t1")).toBe(true);

		const b = performanceReducer(a, { type: "toggle_topic", id: "t1", checked: false });
		expect(b.selectedTopicIds.has("t1")).toBe(false);
	});

	it("clear_topic_selection empties the set; no-op when already empty", () => {
		const dirty = {
			...initialPerformanceState,
			selectedTopicIds: new Set(["t1", "t2"]),
		};
		const cleared = performanceReducer(dirty, { type: "clear_topic_selection" });
		expect(cleared.selectedTopicIds.size).toBe(0);

		const noop = performanceReducer(initialPerformanceState, { type: "clear_topic_selection" });
		expect(noop).toBe(initialPerformanceState);
	});
});

describe("performanceReducer — sheet", () => {
	it("open_sheet sets row and flips open", () => {
		const next = performanceReducer(initialPerformanceState, { type: "open_sheet", row: ROW });
		expect(next.sheetRow).toBe(ROW);
		expect(next.sheetOpen).toBe(true);
	});

	it("close_sheet flips open while keeping the row (so the close animation can read it)", () => {
		const opened = performanceReducer(initialPerformanceState, { type: "open_sheet", row: ROW });
		const closed = performanceReducer(opened, { type: "close_sheet" });
		expect(closed.sheetOpen).toBe(false);
		expect(closed.sheetRow).toBe(ROW);
	});
});

describe("performanceReducer — toolbar popovers (mutual exclusion)", () => {
	it("opening the filters popover closes the sort popover", () => {
		const seeded = {
			...initialPerformanceState,
			sortPopoverOpen: true,
		};
		const next = performanceReducer(seeded, { type: "set_filters_popover", open: true });
		expect(next.filtersPopoverOpen).toBe(true);
		expect(next.sortPopoverOpen).toBe(false);
	});

	it("opening the sort popover closes the filters popover", () => {
		const seeded = {
			...initialPerformanceState,
			filtersPopoverOpen: true,
		};
		const next = performanceReducer(seeded, { type: "set_sort_popover", open: true });
		expect(next.sortPopoverOpen).toBe(true);
		expect(next.filtersPopoverOpen).toBe(false);
	});

	it("closing a popover leaves the other untouched", () => {
		const seeded = {
			...initialPerformanceState,
			filtersPopoverOpen: true,
			sortPopoverOpen: false,
		};
		const next = performanceReducer(seeded, { type: "set_filters_popover", open: false });
		expect(next.filtersPopoverOpen).toBe(false);
		expect(next.sortPopoverOpen).toBe(false);
	});
});

describe("performanceReducer — derived predicates", () => {
	it("hasActiveLocalFilters reflects status, sort, and trimmed-search", () => {
		expect(hasActiveLocalFilters(initialPerformanceState)).toBe(false);
		expect(
			hasActiveLocalFilters({ ...initialPerformanceState, statusFilter: "bad" }),
		).toBe(true);
		expect(hasActiveLocalFilters({ ...initialPerformanceState, sortMode: "last_test" })).toBe(true);
		expect(hasActiveLocalFilters({ ...initialPerformanceState, topicSearch: "  " })).toBe(false);
	});

	it("activePerformanceFilterCount is 1 only when statusFilter is non-default", () => {
		expect(activePerformanceFilterCount(initialPerformanceState)).toBe(0);
		expect(
			activePerformanceFilterCount({ ...initialPerformanceState, statusFilter: "good" }),
		).toBe(1);
	});

	it("performanceSortIsNonDefault flips when sort moves off curriculum", () => {
		expect(performanceSortIsNonDefault(initialPerformanceState)).toBe(false);
		expect(performanceSortIsNonDefault({ ...initialPerformanceState, sortMode: "status" })).toBe(true);
	});
});
