import { formatDateMediumInAppTimeZone } from "@/lib/datetime/app-timezone";
import { cn } from "@/lib/utils";
import type { PerformanceRowSerialized, TrackerStatus } from "@/lib/student/performance-matrix";

export function normalizeTopicSearchText(s: string): string {
	return s.trim().toLowerCase().normalize("NFKC");
}

/** Haystack should already be normalized (NFKC + lowercase). */
export function haystackIncludesNormalized(haystack: string, needle: string): boolean {
	if (!needle) return true;
	return haystack.includes(needle);
}

export function rowMatchesTopicSearch(row: PerformanceRowSerialized, rawQuery: string): boolean {
	const q = rawQuery.trim();
	if (!q) return true;

	const tokens = q
		.split(/\s+/)
		.map((t) => normalizeTopicSearchText(t))
		.filter(Boolean);
	if (tokens.length === 0) return true;

	const topic = normalizeTopicSearchText(row.topicName);
	const unit = normalizeTopicSearchText(row.unitName);
	const chapter = normalizeTopicSearchText(row.chapterName);
	const subject = normalizeTopicSearchText(row.subjectName);

	return tokens.every((token) => {
		if (
			haystackIncludesNormalized(topic, token) ||
			haystackIncludesNormalized(unit, token) ||
			haystackIncludesNormalized(chapter, token) ||
			haystackIncludesNormalized(subject, token)
		) {
			return true;
		}
		if (/^\d+$/.test(token)) {
			const n = Number.parseInt(token, 10);
			return row.unitNumber === n || row.chapterNumber === n || row.topicNumber === n;
		}
		return false;
	});
}

export function emptyPerformanceMatrixMessage(
	searchQuery: string,
	statusFilter: TrackerStatus | "all",
	parentViewer: boolean,
): string {
	const q = searchQuery.trim();
	const hasStatus = statusFilter !== "all";
	if (q && hasStatus) {
		return "No topics match the current status filter and search. Try adjusting filters or use Reset filters.";
	}
	if (q) {
		return "No topics match your search. Try different words or use Reset filters.";
	}
	if (hasStatus) {
		return "No topics match these filters. Try clearing the status filter.";
	}
	return parentViewer
		? "No topic rows for this subject yet. Rows appear once their curriculum is linked to their account; contact support if this stays empty."
		: "No performance tracker rows for this subject yet. Rows are created when your curriculum is linked to your account; contact support if this stays empty.";
}

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

export function practiceHref(
	topicIds: string[],
	subjectId: string | null,
	opts: { basePath: string; allowPractice: boolean },
): string {
	const base = opts.basePath.replace(/\/$/, "");
	if (!opts.allowPractice) {
		const sp = new URLSearchParams();
		if (subjectId) sp.set("subject", subjectId);
		const q = sp.toString();
		return `${base}/performance${q ? `?${q}` : ""}#perf-topic-matrix`;
	}
	if (!topicIds.length) return `${base}/practice`;
	const sp = new URLSearchParams();
	sp.set("topicIds", topicIds.join(","));
	if (subjectId) sp.set("subjectId", subjectId);
	return `${base}/practice?${sp.toString()}`;
}

/** Extra surface styles on top of default `Card` (already uses `cardSurfaceFrameClassName`). */
export const performanceDetailSurfaceClass = cn(
	"bg-muted shadow-sm transition-[border-color,box-shadow,background-color] duration-200 ease-out",
	"hover:border-primary/50 hover:shadow-[0_0_28px_-8px_color-mix(in_oklab,var(--primary)_42%,transparent)]",
	"hover:bg-black/[0.035] dark:bg-card dark:shadow-none dark:hover:bg-muted/30",
);
