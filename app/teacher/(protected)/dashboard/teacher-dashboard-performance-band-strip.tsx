"use client";

import Link from "next/link";
import { AlertTriangle, BarChart3, Crosshair, Trophy } from "lucide-react";
import { useMemo, useState } from "react";

import { cardSurfaceFrameClassName } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type {
	TeacherClassPerformanceSummary,
	TeacherPerformanceBandId,
	TeacherPerformanceBandSummary,
	TeacherPerformanceBandStudent,
} from "@/lib/teachers/teacher-class-performance-summary-types";
import { cn } from "@/lib/utils";

type Props = {
	summary: TeacherClassPerformanceSummary | null;
	pending: boolean;
	error: string | null;
	subjectId: string | "all";
	scopeLabel: string;
};

const bandIcons = {
	strong: Trophy,
	near_target: Crosshair,
	needs_support: BarChart3,
	at_risk: AlertTriangle,
} satisfies Record<TeacherPerformanceBandId, typeof Trophy>;

const bandIconClassNames = {
	strong: "text-primary",
	near_target: "text-muted-foreground",
	needs_support: "text-amber-500/90",
	at_risk: "text-destructive",
} satisfies Record<TeacherPerformanceBandId, string>;

const EMPTY_BANDS: TeacherPerformanceBandSummary[] = [];

function teacherStudentPerformanceHref(studentId: string, subjectId: string | "all") {
	const base = `/teacher/student-performance/${studentId}/performance`;
	if (subjectId === "all") return base;
	const q = new URLSearchParams({ subject: subjectId });
	return `${base}?${q.toString()}`;
}

function formatScore(value: number) {
	return `${Math.round(value)}%`;
}

function formatPlacement(student: TeacherPerformanceBandStudent) {
	const grade = student.grade == null ? null : `Grade ${student.grade}`;
	const section = student.section?.trim() ? `Section ${student.section.trim()}` : null;
	return [grade, section, `${student.recentGradedItemsUsed} recent item${student.recentGradedItemsUsed === 1 ? "" : "s"}`]
		.filter(Boolean)
		.join(" · ");
}

function LoadingStrip() {
	return (
		<div className="grid w-full min-w-0 grid-cols-4 gap-3 pb-1" aria-hidden>
			{Array.from({ length: 4 }, (_, index) => (
				<Skeleton key={index} className="h-24 w-full min-w-0 rounded-xl" />
			))}
		</div>
	);
}

function distributionScreenReaderSummary(
	summary: TeacherClassPerformanceSummary | null,
	bands: TeacherPerformanceBandSummary[],
): string | null {
	if (!summary || bands.length === 0) return null;
	const scope = summary.studentsInScope;
	const parts = bands.map((band) => `${band.count} ${band.label.toLowerCase()}`).join(", ");
	const scopeLabel = `${scope} ${scope === 1 ? "student" : "students"} in scope`;
	if (summary.studentsWithRecentScores === 0) {
		return `Distribution summary: ${scopeLabel}, none with recent graded work yet.`;
	}
	return `Distribution summary across ${scopeLabel}: ${parts}.`;
}

function distributionInsight(summary: TeacherClassPerformanceSummary | null) {
	if (!summary) return null;
	if (summary.studentsInScope === 0) {
		return "No students match this scope yet. Adjust the filters or manage linked students to start monitoring.";
	}
	if (summary.studentsWithRecentScores === 0) {
		return `${summary.studentsInScope} students are in scope, but none have recent graded work yet. Grade an assignment or practice test to populate this view.`;
	}

	const urgent = summary.performanceBands.find((band) => band.id === "at_risk");
	const support = summary.performanceBands.find((band) => band.id === "needs_support");
	const nearTarget = summary.performanceBands.find((band) => band.id === "near_target");
	const strong = summary.performanceBands.find((band) => band.id === "strong");

	if (urgent && urgent.count > 0) {
		return `${urgent.count} ${urgent.count === 1 ? "student needs" : "students need"} intervention this week. Open the at-risk band first.`;
	}
	if (support && support.count > 0) {
		return `${support.count} ${support.count === 1 ? "student needs" : "students need"} small-group practice before the next review.`;
	}
	if (nearTarget && nearTarget.count >= (strong?.count ?? 0)) {
		return "Most scored students are near target. A short whole-class review is the fastest next move.";
	}
	return "Most scored students are strong. Use extension work or check topic-level gaps next.";
}

function BandCard({
	band,
	selected,
	onClick,
}: {
	band: TeacherPerformanceBandSummary;
	selected: boolean;
	onClick: () => void;
}) {
	const Icon = bandIcons[band.id];

	return (
		<button
			type="button"
			className={cn(
				cardSurfaceFrameClassName,
				"group flex min-h-24 w-full min-w-0 flex-col gap-2 p-3 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
				selected && "border-ring bg-muted/35",
			)}
			aria-label={`Show ${band.count} students in ${band.label}`}
			onClick={onClick}
		>
			<span className="flex w-full min-w-0 items-start justify-between gap-3">
				<span className="min-w-0 truncate text-sm font-medium text-foreground">{band.label}</span>
				<span className="flex shrink-0 items-center gap-2">
					<span className="shrink-0 text-muted-foreground text-[11px] tabular-nums">{band.rangeLabel}</span>
					<span
						className={cn(
							"flex shrink-0 items-center justify-center [&_svg]:size-[1.05rem]",
							bandIconClassNames[band.id],
						)}
						aria-hidden
					>
						<Icon />
					</span>
				</span>
			</span>
			<span className="min-w-0">
				<span className="block text-lg font-semibold tracking-tight text-foreground tabular-nums">
					{band.count} {band.count === 1 ? "student" : "students"}
				</span>
				<span className="mt-0.5 block truncate text-muted-foreground text-xs">{band.description}</span>
			</span>
		</button>
	);
}

function BandStudentTable({
	band,
	subjectId,
}: {
	band: TeacherPerformanceBandSummary;
	subjectId: string | "all";
}) {
	if (band.students.length === 0) {
		return (
			<p className="rounded-lg border border-border bg-muted/15 px-3 py-3 text-muted-foreground text-sm">
				No students are currently in this band for the selected scope.
			</p>
		);
	}

	return (
		<div className="min-h-0 overflow-y-auto rounded-lg border border-border">
			<Table className="border-separate border-spacing-0">
				<TableHeader className="sticky top-0 z-10 bg-muted">
					<TableRow className="hover:bg-transparent">
						<TableHead className="h-9 px-3 text-xs">Student</TableHead>
						<TableHead className="h-9 px-3 text-right text-xs">Score</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{band.students.map((student) => (
						<TableRow key={student.studentId} className="hover:bg-muted/30">
							<TableCell className="min-w-0 whitespace-normal px-3 py-3">
								<Link
									href={teacherStudentPerformanceHref(student.studentId, subjectId)}
									className="group/student block min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
								>
									<span className="block truncate font-medium text-foreground group-hover/student:underline group-hover/student:underline-offset-4">
										{student.fullName}
									</span>
									<span className="mt-0.5 block truncate text-muted-foreground text-xs">
										{formatPlacement(student)}
									</span>
								</Link>
							</TableCell>
							<TableCell className="px-3 py-3 text-right font-mono text-foreground text-sm tabular-nums">
								{formatScore(student.averagePercent)}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}

export function TeacherDashboardPerformanceBandStrip({ summary, pending, error, subjectId, scopeLabel }: Props) {
	const scopeKey = `${scopeLabel}:${subjectId}`;
	const [selectedBand, setSelectedBand] = useState<{
		id: TeacherPerformanceBandId;
		scopeKey: string;
	} | null>(null);
	const bands = summary?.performanceBands ?? EMPTY_BANDS;

	const selectedBandSummary = useMemo(
		() =>
			selectedBand?.scopeKey === scopeKey ? (bands.find((band) => band.id === selectedBand.id) ?? null) : null,
		[bands, scopeKey, selectedBand],
	);

	if (pending && summary == null) {
		return <LoadingStrip />;
	}

	if (error && summary == null) {
		return (
			<p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive text-sm" role="alert">
				{error}
			</p>
		);
	}

	if (bands.length === 0) return null;

	const insight = distributionInsight(summary);
	const accessibleSummary = distributionScreenReaderSummary(summary, bands);

	return (
		<section className="flex min-w-0 flex-col gap-3" aria-label="Student distribution by performance band">
			{accessibleSummary ? <span className="sr-only">{accessibleSummary}</span> : null}
			<div className="flex flex-col gap-2">
				<div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
					<div className="min-w-0">
						<h2 className="text-base font-medium tracking-tight text-foreground">Student distribution</h2>
						<p className="text-muted-foreground text-sm">
							Recent average across the latest {summary?.recentWindowSize ?? 5} graded items.
						</p>
					</div>
					<p className="text-muted-foreground text-xs">Click a band to view students.</p>
				</div>
				{insight ? (
					<p className="rounded-lg border border-border bg-muted/15 px-3 py-2 text-sm text-foreground">{insight}</p>
				) : null}
			</div>
			<div className="grid w-full min-w-0 grid-cols-4 gap-3 pb-1">
				{bands.map((band) => (
					<div key={band.id} className="min-w-0">
						<BandCard
							band={band}
							selected={band.id === selectedBandSummary?.id}
							onClick={() => setSelectedBand({ id: band.id, scopeKey })}
						/>
					</div>
				))}
			</div>

			<Sheet open={selectedBandSummary != null} onOpenChange={(open) => !open && setSelectedBand(null)}>
				<SheetContent side="right" className="w-full max-w-[min(100vw-1rem,28rem)] gap-0 p-0 medium:max-w-lg">
					{selectedBandSummary ? (
						<>
							<SheetHeader className="border-border border-b p-5 text-left">
								<SheetTitle className="text-lg">{selectedBandSummary.label}</SheetTitle>
								<SheetDescription>
									{selectedBandSummary.count} {selectedBandSummary.count === 1 ? "student" : "students"} in{" "}
									{selectedBandSummary.rangeLabel} · {scopeLabel}
								</SheetDescription>
							</SheetHeader>
							<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
								<BandStudentTable band={selectedBandSummary} subjectId={subjectId} />
							</div>
						</>
					) : null}
				</SheetContent>
			</Sheet>
		</section>
	);
}
