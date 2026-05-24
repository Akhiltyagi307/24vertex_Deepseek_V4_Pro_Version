import * as React from "react";
import { MinusIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { z } from "zod";

import type {
	ChapterGroup,
	PerformanceRowSerialized,
	TrackerStatus,
} from "@/lib/student/performance-matrix";
import { formatDateMediumInAppTimeZone } from "@/lib/datetime/app-timezone";
import { cn } from "@/lib/utils";

import type { PracticeEnrolledSubject } from "./types";

/** Match `StudentPerformanceView` topic matrix badges. */
export function statusBadgeVariant(
	status: TrackerStatus,
): "default" | "secondary" | "destructive" | "outline" {
	if (status === "good") return "default";
	if (status === "bad") return "destructive";
	if (status === "satisfactory") return "secondary";
	return "outline";
}

export function performanceStatusBadgeClass(status: TrackerStatus): string {
	if (status === "not_tested") {
		return "h-6 border-transparent bg-muted px-2.5 text-[13px] font-medium text-muted-foreground";
	}
	return "h-6 px-2.5 text-[13px] font-semibold";
}

export { formatTrackerStatusLabel as statusLabel } from "@/lib/student/tracker-status-labels";

export function trendLabel(t: PerformanceRowSerialized["trend"]): string {
	if (t === "improving") return "Improving";
	if (t === "declining") return "Declining";
	return "Stable";
}

export function formatLastTest(iso: string | null): string {
	if (!iso) return "—";
	try {
		return formatDateMediumInAppTimeZone(iso);
	} catch {
		return "—";
	}
}

export function formatScore(n: number | null): string {
	if (n == null || Number.isNaN(n)) return "—";
	return `${Math.round(n)}%`;
}

/** Left border on topic rows — same as performance matrix. */
export function statusRowAccentClass(status: TrackerStatus): string {
	switch (status) {
		case "good":
			return "border-s-primary";
		case "satisfactory":
			return "border-s-primary/45";
		case "bad":
			return "border-s-destructive";
		default:
			return "border-s-muted-foreground/35";
	}
}

export function trendIcon(row: PerformanceRowSerialized) {
	const common = "size-3.5 shrink-0";
	if (row.trend === "improving") {
		return <TrendingUpIcon className={cn(common, "text-primary")} aria-hidden />;
	}
	if (row.trend === "declining") {
		return <TrendingDownIcon className={cn(common, "text-destructive")} aria-hidden />;
	}
	return <MinusIcon className={cn(common, "text-muted-foreground")} aria-hidden />;
}

export function trackerIdsForChapter(ch: ChapterGroup): string[] {
	return ch.rows.map((r) => r.trackerId);
}

const uuidStringSchema = z.string().uuid();

export function parseTopicIdsSearchParam(raw: string | null): string[] {
	if (!raw?.trim()) return [];
	return raw
		.split(",")
		.map((s) => s.trim())
		.filter((s) => uuidStringSchema.safeParse(s).success);
}

export { uuidStringSchema };

export function selectionFlagsForIds(selected: Set<string>, ids: string[]) {
	if (ids.length === 0) return { all: false, some: false };
	let n = 0;
	for (const id of ids) {
		if (selected.has(id)) n += 1;
	}
	return { all: n === ids.length, some: n > 0 && n < ids.length };
}

export function IndeterminateCheckbox({
	indeterminate,
	className,
	...props
}: Omit<React.ComponentProps<"input">, "ref" | "type"> & { indeterminate?: boolean }) {
	const ref = React.useRef<HTMLInputElement>(null);
	React.useEffect(() => {
		if (ref.current) ref.current.indeterminate = Boolean(indeterminate);
	}, [indeterminate]);
	return <input ref={ref} type="checkbox" className={className} {...props} />;
}

/**
 * Topic matrix sits in horizontal `overflow-x-auto` regions. Some browsers do not
 * route vertical wheel deltas to the main content column. When the inset can scroll,
 * apply the delta there (single scroll surface for the practice hub).
 */
export function forwardWheelToWizardStepScroll(e: React.WheelEvent<HTMLDivElement>) {
	if (e.ctrlKey) return;
	if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

	const inset = e.currentTarget.closest<HTMLElement>("[data-slot='sidebar-inset']");
	if (!inset) return;
	if (inset.scrollHeight <= inset.clientHeight) return;

	inset.scrollTop += e.deltaY;
	e.preventDefault();
}

export function formatStepErrors(err: z.ZodError): string {
	const flat = err.flatten();
	const fieldMsgs = Object.values(flat.fieldErrors).flat().filter(Boolean);
	const formMsgs = flat.formErrors.filter(Boolean);
	return [...fieldMsgs, ...formMsgs].join(" ") || "Please check this step.";
}

export function clusterSubjectsByGroup(subjects: PracticeEnrolledSubject[]) {
	const clusters: { groupLabel: string | null; items: PracticeEnrolledSubject[] }[] = [];
	for (const s of subjects) {
		const g = s.subject_group?.trim() ? s.subject_group : null;
		const prev = clusters[clusters.length - 1];
		if (prev && prev.groupLabel === g) {
			prev.items.push(s);
		} else {
			clusters.push({ groupLabel: g, items: [s] });
		}
	}
	return clusters;
}
