/**
 * Cohort gate for the Phase 2 review-scheduler staged rollout.
 *
 * The two knobs — rollout percentage + org allowlist — live in SQL functions
 * flipped via CREATE OR REPLACE (mirroring `review_scheduler_enabled()`), so a
 * rollout is widened with no migration. This module is the PURE membership
 * predicate the selector applies per student. Defaults (pct 0, empty allowlist)
 * mean "nobody", so the loop stays dormant under the global kill-switch until a
 * cohort is deliberately populated.
 */

/** FNV-1a 32-bit → 0–99 bucket. Deterministic + well-distributed per student. */
function studentBucket(studentId: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < studentId.length; i++) {
		h ^= studentId.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return (h >>> 0) % 100;
}

/** True when the student falls within the rollout percentage (0 ⇒ none, ≥100 ⇒ all). */
export function isStudentInRolloutPct(studentId: string, pct: number): boolean {
	if (pct <= 0) return false;
	if (pct >= 100) return true;
	return studentBucket(studentId) < pct;
}

/** Cohort membership: org allowlist (pilot schools) OR the percentage rollout. */
export function studentInReviewCohort(args: {
	studentId: string;
	orgId: string | null;
	rolloutPct: number;
	cohortOrgIds: string[];
}): boolean {
	if (args.orgId && args.cohortOrgIds.includes(args.orgId)) return true;
	return isStudentInRolloutPct(args.studentId, args.rolloutPct);
}
