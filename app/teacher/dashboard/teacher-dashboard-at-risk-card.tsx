"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";

import { fetchTeacherAtRiskStudents } from "./teacher-dashboard-actions";
import { cardSurfaceFrameClassName } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { TeacherAtRiskStudentRow } from "@/lib/teachers/teacher-at-risk-types";
import { cn } from "@/lib/utils";

function teacherStudentPerformanceHref(studentId: string, subjectId: string | "all") {
	const base = `/teacher/student-performance/${studentId}/performance`;
	if (subjectId === "all") return base;
	const q = new URLSearchParams({ subject: subjectId });
	return `${base}?${q.toString()}`;
}

type Props = {
	grade: number | "all";
	section: string | "all";
	subjectId: string | "all";
	thresholdPercent: number;
	lastGradedCount: number;
	studentsInScope: number | null;
	studentsWithRecentScores: number | null;
};

export function TeacherDashboardAtRiskCard({
	grade,
	section,
	subjectId,
	thresholdPercent,
	lastGradedCount,
	studentsInScope,
	studentsWithRecentScores,
}: Props) {
	const [rows, setRows] = useState<TeacherAtRiskStudentRow[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(true);

	useEffect(() => {
		let cancelled = false;
		setPending(true);
		setError(null);
		setRows([]);
		void (async () => {
			try {
				const res = await fetchTeacherAtRiskStudents({ grade, section, subjectId });
				if (cancelled) return;
				if ("error" in res) {
					setError(res.error);
					setRows([]);
					return;
				}
				setRows(res.rows);
			} catch {
				if (cancelled) return;
				setError("Could not load at-risk students for this scope.");
				setRows([]);
			} finally {
				if (!cancelled) {
					setPending(false);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [grade, section, subjectId]);

	return (
		<div
			className={cn(
				cardSurfaceFrameClassName,
				"flex h-full min-h-[min(40vh,20rem)] flex-col overflow-hidden p-6 text-left",
			)}
			aria-busy={pending}
			aria-live="polite"
		>
			<div className="flex w-full shrink-0 items-start justify-between gap-3">
				<p className="min-w-0 text-sm font-medium text-foreground">At-risk students</p>
				<AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500/90" aria-hidden />
			</div>

			{error ? (
				<p className="mt-3 shrink-0 text-destructive text-xs" role="alert">
					{error}
				</p>
			) : null}

			<div className="mt-4 flex min-h-0 flex-1 flex-col">
				{pending && rows.length === 0 ? (
					<div className="flex flex-col gap-2" aria-hidden>
						<Skeleton className="h-14 shrink-0 rounded-lg" />
						<Skeleton className="h-14 shrink-0 rounded-lg" />
					</div>
				) : rows.length === 0 ? (
					<div className="rounded-lg border border-border bg-muted/15 px-3 py-3">
						{studentsInScope === 0 ? (
							<>
								<p className="text-sm font-medium text-foreground">No students in the selected scope</p>
								<p className="mt-1 text-muted-foreground text-xs leading-normal">
									Adjust the filters or manage linked students to start monitoring risk.
								</p>
							</>
						) : studentsWithRecentScores === 0 ? (
							<>
								<p className="text-sm font-medium text-foreground">No recent graded work yet</p>
								<p className="mt-1 text-muted-foreground text-xs leading-normal">
									At-risk alerts appear after students have graded assignments or practice tests.
								</p>
							</>
						) : (
							<>
								<p className="text-sm font-medium text-foreground">No at-risk students in this scope</p>
								<p className="mt-1 text-muted-foreground text-xs leading-normal">
									This card flags students below {thresholdPercent}% across their latest {lastGradedCount} graded{" "}
									{lastGradedCount === 1 ? "item" : "items"}.
								</p>
							</>
						)}
					</div>
				) : (
					<ul
						className="min-h-0 flex-1 divide-y divide-border overflow-y-auto overscroll-y-contain rounded-lg border border-border/60 text-sm"
						role="list"
					>
						{rows.map((r) => (
							<li key={r.studentId} className="hover:bg-muted/30">
								<Link
									href={teacherStudentPerformanceHref(r.studentId, subjectId)}
									className="flex w-full min-w-0 flex-col gap-0.5 px-3 py-2.5 text-left outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
								>
									<span className="font-medium text-foreground">{r.fullName}</span>
									<span className="text-muted-foreground text-xs leading-snug">{r.summary}</span>
								</Link>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
