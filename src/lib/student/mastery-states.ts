import type { TrackerStatus } from "@/lib/student/tracker-status-labels";

/**
 * Educator-facing mastery bands derived from existing tracker signals.
 * Kept separate from student-facing readiness labels (Strong / On track /
 * Strengthen) so motivation copy and pedagogy framing can diverge.
 */
export type MasteryState = "not_started" | "familiar" | "proficient" | "mastered";

/** Display labels for {@link MasteryState} (educator + parent surfaces). */
export const MASTERY_STATE_LABELS = {
	not_started: "Not started",
	familiar: "Familiar",
	proficient: "Proficient",
	mastered: "Mastered",
} as const satisfies Record<MasteryState, string>;

const MASTERY_STATES: readonly MasteryState[] = [
	"not_started",
	"familiar",
	"proficient",
	"mastered",
];

export function isMasteryState(raw: string): raw is MasteryState {
	return (MASTERY_STATES as readonly string[]).includes(raw);
}

export function formatMasteryStateLabel(state: MasteryState): string {
	return MASTERY_STATE_LABELS[state];
}

export type ComputeMasteryStateInput = {
	status: TrackerStatus;
	testsTaken: number;
	/** Mean percent (0–100). `null` is treated as no measured score. */
	averageScore: number | null;
};

/**
 * Derive a mastery band from existing performance signals — no DB change.
 *
 * Thresholds:
 * - no attempts (`testsTaken === 0`, `status === "not_tested"`, or no score) → `not_started`
 * - average `< 50` → `familiar`
 * - average `< 75` → `proficient`
 * - average `>= 75` → `mastered`
 */
export function computeMasteryState(input: ComputeMasteryStateInput): MasteryState {
	const { status, testsTaken, averageScore } = input;
	if (testsTaken <= 0 || status === "not_tested") return "not_started";
	if (averageScore == null || !Number.isFinite(averageScore)) return "not_started";
	if (averageScore < 50) return "familiar";
	if (averageScore < 75) return "proficient";
	return "mastered";
}
