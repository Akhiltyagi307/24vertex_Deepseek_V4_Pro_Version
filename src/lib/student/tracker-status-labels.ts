export type TrackerStatus = "good" | "satisfactory" | "bad" | "not_tested";

/** User-facing labels for performance tracker bands (Set 3 — readiness). */
export const TRACKER_STATUS_LABELS = {
	good: "Strong",
	satisfactory: "On track",
	bad: "Strengthen",
	not_tested: "Not tested",
} as const satisfies Record<TrackerStatus, string>;

/** Subject-level rollup label (one of the three tested bands). */
export type SubjectStatusLabel =
	| typeof TRACKER_STATUS_LABELS.good
	| typeof TRACKER_STATUS_LABELS.satisfactory
	| typeof TRACKER_STATUS_LABELS.bad;

/** Default subject card label when no topics have been tested yet. */
export const DEFAULT_SUBJECT_STATUS_LABEL: SubjectStatusLabel = TRACKER_STATUS_LABELS.satisfactory;

const TRACKER_STATUS_SLUGS: readonly TrackerStatus[] = [
	"good",
	"satisfactory",
	"bad",
	"not_tested",
];

export function isTrackerStatus(raw: string): raw is TrackerStatus {
	return (TRACKER_STATUS_SLUGS as readonly string[]).includes(raw);
}

export function formatTrackerStatusLabel(status: TrackerStatus): string {
	return TRACKER_STATUS_LABELS[status];
}

const LEGACY_TRACKER_STATUS_LABELS: Record<string, SubjectStatusLabel | typeof TRACKER_STATUS_LABELS.not_tested> = {
	good: TRACKER_STATUS_LABELS.good,
	satisfactory: TRACKER_STATUS_LABELS.satisfactory,
	bad: TRACKER_STATUS_LABELS.bad,
	not_tested: TRACKER_STATUS_LABELS.not_tested,
	Good: TRACKER_STATUS_LABELS.good,
	Satisfactory: TRACKER_STATUS_LABELS.satisfactory,
	Bad: TRACKER_STATUS_LABELS.bad,
	"Needs improvement": TRACKER_STATUS_LABELS.bad,
	"Needs work": TRACKER_STATUS_LABELS.bad,
};

/** Map DB/API slug or an already-formatted label to the canonical display string. */
export function formatTrackerStatusFromRaw(raw: string | null | undefined): string {
	if (raw == null || raw === "") return "—";
	if (isTrackerStatus(raw)) return formatTrackerStatusLabel(raw);
	const legacy = LEGACY_TRACKER_STATUS_LABELS[raw];
	if (legacy) return legacy;
	const byLabel = Object.values(TRACKER_STATUS_LABELS).find(
		(label) => label.toLowerCase() === raw.toLowerCase(),
	);
	if (byLabel) return byLabel;
	return raw;
}

/** Lower rank = weaker subject mix (sort worst-first). */
export function subjectStatusLabelRank(status: SubjectStatusLabel): number {
	if (status === TRACKER_STATUS_LABELS.bad) return 0;
	if (status === TRACKER_STATUS_LABELS.satisfactory) return 1;
	return 2;
}
