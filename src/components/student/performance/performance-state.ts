import type {
	PerformanceRowSerialized,
	SortMode,
	TrackerStatus,
} from "@/lib/student/performance-matrix";

/**
 * UI state for the student performance view. Consolidates 9 useState hooks
 * into a single discriminated reducer so callers (and tests) can reason
 * about transitions in one place. Pure logic; no React.
 */
export type PerformanceState = {
	statusFilter: TrackerStatus | "all";
	sortMode: SortMode;
	topicSearch: string;
	selectedTopicIds: Set<string>;
	sheetRow: PerformanceRowSerialized | null;
	sheetOpen: boolean;
	summaryOpen: boolean;
	/** Filters popover (matrix toolbar). Mutually exclusive with the sort popover. */
	filtersPopoverOpen: boolean;
	/** Sort popover (matrix toolbar). Mutually exclusive with the filters popover. */
	sortPopoverOpen: boolean;
};

export type PerformanceAction =
	| { type: "set_status_filter"; value: TrackerStatus | "all" }
	| { type: "set_sort_mode"; value: SortMode }
	| { type: "set_topic_search"; value: string }
	| { type: "toggle_topic"; id: string; checked: boolean }
	| { type: "clear_topic_selection" }
	| { type: "open_sheet"; row: PerformanceRowSerialized }
	| { type: "close_sheet" }
	| { type: "set_summary_open"; open: boolean }
	| { type: "set_filters_popover"; open: boolean }
	| { type: "set_sort_popover"; open: boolean }
	| { type: "reset_local_filters" };

export const initialPerformanceState: PerformanceState = {
	statusFilter: "all",
	sortMode: "curriculum",
	topicSearch: "",
	selectedTopicIds: new Set<string>(),
	sheetRow: null,
	sheetOpen: false,
	summaryOpen: true,
	filtersPopoverOpen: false,
	sortPopoverOpen: false,
};

export function performanceReducer(state: PerformanceState, action: PerformanceAction): PerformanceState {
	switch (action.type) {
		case "set_status_filter":
			return state.statusFilter === action.value ? state : { ...state, statusFilter: action.value };
		case "set_sort_mode":
			return state.sortMode === action.value ? state : { ...state, sortMode: action.value };
		case "set_topic_search":
			return state.topicSearch === action.value ? state : { ...state, topicSearch: action.value };
		case "toggle_topic": {
			const next = new Set(state.selectedTopicIds);
			if (action.checked) next.add(action.id);
			else next.delete(action.id);
			return { ...state, selectedTopicIds: next };
		}
		case "clear_topic_selection":
			return state.selectedTopicIds.size === 0 ? state : { ...state, selectedTopicIds: new Set() };
		case "open_sheet":
			return { ...state, sheetRow: action.row, sheetOpen: true };
		case "close_sheet":
			return state.sheetOpen ? { ...state, sheetOpen: false } : state;
		case "set_summary_open":
			return state.summaryOpen === action.open ? state : { ...state, summaryOpen: action.open };
		case "set_filters_popover":
			// Opening the filters popover closes the sort popover (mutual exclusion).
			return action.open
				? { ...state, filtersPopoverOpen: true, sortPopoverOpen: false }
				: { ...state, filtersPopoverOpen: false };
		case "set_sort_popover":
			return action.open
				? { ...state, sortPopoverOpen: true, filtersPopoverOpen: false }
				: { ...state, sortPopoverOpen: false };
		case "reset_local_filters":
			return {
				...state,
				statusFilter: "all",
				sortMode: "curriculum",
				topicSearch: "",
			};
		default: {
			const _exhaustive: never = action;
			return _exhaustive;
		}
	}
}

/** True when filters/sort/search differ from defaults. */
export function hasActiveLocalFilters(state: PerformanceState): boolean {
	return (
		state.statusFilter !== "all" ||
		state.sortMode !== "curriculum" ||
		state.topicSearch.trim().length > 0
	);
}

/** Number of active filter categories (1 if a non-default status filter, else 0). */
export function activePerformanceFilterCount(state: PerformanceState): number {
	return state.statusFilter !== "all" ? 1 : 0;
}

/** True when sort is non-default. */
export function performanceSortIsNonDefault(state: PerformanceState): boolean {
	return state.sortMode !== "curriculum";
}
