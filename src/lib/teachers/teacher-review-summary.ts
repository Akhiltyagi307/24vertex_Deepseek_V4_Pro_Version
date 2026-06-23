import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { tests } from "@/db/schema/assessment";
import { listTeacherPerformanceDirectoryStudents } from "@/lib/teachers/teacher-performance-directory-queries";

export type TeacherReviewSummary = {
	/** Total auto-review tests issued to the class. */
	issued: number;
	/** Review tests that have been graded. */
	completed: number;
	/** Issued but not graded, older than the overdue window. */
	overdue: number;
};

const OVERDUE_AFTER_DAYS = 2;
const MS_PER_DAY = 86_400_000;

/** Pure: derive issued/completed/overdue counts from review-test rows. */
export function shapeReviewSummary(
	rows: { status: string | null; testDateMs: number | null }[],
	nowMs: number,
): TeacherReviewSummary {
	const overdueCutoff = nowMs - OVERDUE_AFTER_DAYS * MS_PER_DAY;
	let issued = 0;
	let completed = 0;
	let overdue = 0;
	for (const r of rows) {
		issued += 1;
		if (r.status === "graded") {
			completed += 1;
		} else if (r.testDateMs != null && r.testDateMs < overdueCutoff) {
			overdue += 1;
		}
	}
	return { issued, completed, overdue };
}

/**
 * Read-only class summary of auto-retests over the teacher's roster (org or
 * link-code students). Class-wide totals (all subjects) — a stable overview.
 */
export async function loadTeacherReviewSummary(params: {
	teacherId: string;
	activeOrganizationId: string | null;
	gradesInScope?: number[];
}): Promise<TeacherReviewSummary> {
	const roster = await listTeacherPerformanceDirectoryStudents({
		teacherId: params.teacherId,
		activeOrganizationId: params.activeOrganizationId,
		gradesInScope: params.gradesInScope,
	});
	const studentIds = roster.map((s) => s.id);
	if (studentIds.length === 0) return { issued: 0, completed: 0, overdue: 0 };

	const rows = await db
		.select({ status: tests.status, testDate: tests.testDate })
		.from(tests)
		.where(and(eq(tests.testType, "review"), inArray(tests.studentId, studentIds)));

	return shapeReviewSummary(
		rows.map((r) => ({
			status: r.status ?? null,
			testDateMs: r.testDate ? new Date(r.testDate as unknown as string).getTime() : null,
		})),
		Date.now(),
	);
}
