"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { motion, type Variants } from "motion/react";

import { dashboardSubjectCardCtaClassName } from "@/components/student/dashboard-subject-card";
import { Button } from "@/components/ui/button";
import type { SubjectStatusLabel } from "@/lib/student/performance-matrix";
import { cn } from "@/lib/utils";

/** Mirrors `StudentDashboardSubjectCard` from the dashboard view. */
export type DashboardSubjectCompactModel = {
	subjectId: string;
	subjectName: string;
	percentCovered: number;
	topicTotal: number;
	attemptedCount: number;
	testsTaken: number;
	lastTestDateIso: string | null;
	status: SubjectStatusLabel;
	scorePercent: number | null;
	practiceHref: string;
};

function formatLastTestShort(iso: string | null): string {
	if (!iso) return "";
	try {
		return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
	} catch {
		return "";
	}
}

type RowVisual = "bad" | "warn" | "good" | "idle" | "muted";

function rowVisualForCard(s: DashboardSubjectCompactModel): {
	visual: RowVisual;
	statusLabel: string;
} {
	const hasTopics = s.topicTotal > 0;
	const hasAttempts = s.attemptedCount > 0;

	if (!hasTopics) {
		return { visual: "muted", statusLabel: "No topics" };
	}
	if (!hasAttempts) {
		return { visual: "idle", statusLabel: "Not started" };
	}
	if (s.status === "Bad") {
		return { visual: "bad", statusLabel: "Needs attention" };
	}
	if (s.status === "Satisfactory") {
		return { visual: "warn", statusLabel: "In progress" };
	}
	return { visual: "good", statusLabel: "On track" };
}

const DOT: Record<RowVisual, string> = {
	bad: "bg-red-400",
	warn: "bg-amber-400",
	good: "bg-emerald-400",
	idle: "bg-gray-500",
	muted: "bg-gray-600",
};

const TEXT: Record<RowVisual, string> = {
	bad: "text-red-400",
	warn: "text-amber-400",
	good: "text-emerald-400",
	idle: "text-gray-400",
	muted: "text-gray-500",
};

const BAR: Record<RowVisual, string> = {
	bad: "bg-red-400/90",
	warn: "bg-amber-400/90",
	good: "bg-emerald-400/90",
	idle: "bg-transparent",
	muted: "bg-transparent",
};

/** Same horizontal padding as `commonTd` so header labels align with cell content. */
const th = "px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-foreground/90 medium:px-4";

/** Header cell chrome: must sit on `th` (not `tr`) so `rounded-t-*` works with `border-separate`. */
const thHeaderBg = "border-border border-b-2 bg-muted/60";

/** Opaque header background + stacking so sticky thead covers scrolling rows (see scroll wrapper below). */
const thSticky = "sticky top-0 z-10 bg-muted backdrop-blur-sm";

function TableRow({
	children,
	className,
	rowVariants,
}: {
	children: ReactNode;
	className?: string;
	rowVariants?: Variants;
}) {
	if (rowVariants) {
		return (
			<motion.tr variants={rowVariants} className={cn(className, "last:[&>td]:border-b-0")}>
				{children}
			</motion.tr>
		);
	}
	return <tr className={cn(className, "last:[&>td]:border-b-0")}>{children}</tr>;
}

export type DashboardOtherSubjectsTableProps = {
	subjects: DashboardSubjectCompactModel[];
	/** Staggered list: parent `container` on `<motion.tbody>`, `item` on each `<motion.tr>`. */
	motionContainer?: Variants;
	motionItem?: Variants;
};

export function DashboardOtherSubjectsTable({
	subjects,
	motionContainer,
	motionItem,
}: DashboardOtherSubjectsTableProps) {
	const useRowMotion = Boolean(motionItem);

	return (
		<div
			className={cn(
				"min-w-0 w-full max-h-[min(28rem,55vh)] overflow-auto overscroll-contain [scrollbar-gutter:stable]",
			)}
		>
			<table
				className="w-full min-w-[36rem] border-separate border-spacing-0 text-sm medium:min-w-0"
				aria-label="Other subjects and quick links to practice"
			>
				<thead>
					<tr>
						<th
							scope="col"
							className={cn(th, thHeaderBg, thSticky, "rounded-tl-lg", "w-[24%] min-w-[7.5rem] medium:w-[22%]")}
						>
							Subject
						</th>
						<th scope="col" className={cn(th, thHeaderBg, thSticky, "w-[18%] min-w-[5.5rem]")}>
							Status
						</th>
						<th scope="col" className={cn(th, thHeaderBg, thSticky, "w-[30%] min-w-[9rem]")}>
							Progress
						</th>
						<th scope="col" className={cn(th, thHeaderBg, thSticky, "w-14 text-right tabular-nums medium:w-16")}>
							Coverage
						</th>
						<th
							scope="col"
							className={cn(th, thHeaderBg, thSticky, "w-[3.5rem] text-right tabular-nums medium:w-16")}
						>
							Avg score
						</th>
						<th scope="col" className={cn(th, thHeaderBg, thSticky, "rounded-tr-lg", "w-9 text-right")}>
							<span className="sr-only">Open practice</span>
						</th>
					</tr>
				</thead>
				<motion.tbody
					initial={motionContainer ? "hidden" : false}
					animate={motionContainer ? "show" : undefined}
					variants={motionContainer}
				>
					{subjects.map((s) => {
						const hasTopics = s.topicTotal > 0;
						if (!hasTopics) {
							return (
								<NoTopicsRow
									key={s.subjectId}
									s={s}
									rowVariants={useRowMotion ? motionItem : undefined}
								/>
							);
						}
						return <DataRow key={s.subjectId} s={s} rowVariants={useRowMotion ? motionItem : undefined} />;
					})}
				</motion.tbody>
			</table>
		</div>
	);
}

function NoTopicsRow({ s, rowVariants }: { s: DashboardSubjectCompactModel; rowVariants?: Variants }) {
	const lastLabel = s.lastTestDateIso ? formatLastTestShort(s.lastTestDateIso) : null;
	const commonTd = "border-border/50 border-b px-3 py-3 align-middle medium:px-4";

	return (
		<TableRow className="hover:bg-white/[0.02]" rowVariants={rowVariants}>
			<td className={cn(commonTd, "min-w-0")}>
				<div className="truncate text-sm font-medium text-foreground">{s.subjectName}</div>
				<div className="text-xs text-muted-foreground">
					{lastLabel ? `Last test · ${lastLabel}` : "No tests recorded yet"}
				</div>
			</td>
			<td className={commonTd}>
				<div className="flex items-center gap-1.5">
					<span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gray-600" />
					<span className="text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground">No topics</span>
				</div>
			</td>
			<td className={commonTd}>
				<div className="h-1.5 w-full max-w-[8rem] rounded-full bg-white/[0.04]" aria-hidden />
			</td>
			<td className={cn(commonTd, "text-right text-sm tabular-nums text-muted-foreground")}>—</td>
			<td className={cn(commonTd, "text-right text-sm tabular-nums text-muted-foreground")}>—</td>
			<td className={cn(commonTd, "text-right")}>
				<Button
					variant="secondary"
					size="sm"
					className={cn(dashboardSubjectCardCtaClassName, "w-full max-w-[8.5rem] medium:w-auto")}
					render={<Link href={s.practiceHref} />}
				>
					Practice focus
				</Button>
			</td>
		</TableRow>
	);
}

function DataRow({ s, rowVariants }: { s: DashboardSubjectCompactModel; rowVariants?: Variants }) {
	const { visual, statusLabel } = rowVisualForCard(s);
	const hasAttempts = s.attemptedCount > 0;
	const lastShort = formatLastTestShort(s.lastTestDateIso);
	const meta = lastShort ? `Last test · ${lastShort}` : "No tests yet";
	const coveragePct = s.percentCovered;
	const progressLabel = `${s.attemptedCount} / ${s.topicTotal} topics`;
	const doneDisplay = hasAttempts ? `${coveragePct}%` : "—";
	const scoreDisplay = !hasAttempts ? "—" : s.scorePercent != null ? `${s.scorePercent}%` : "—";
	const scoreClass = cn(
		!hasAttempts ? "text-gray-500" : TEXT[visual],
	);
	const goLabel = `Open practice for ${s.subjectName}`;

	const commonTd = "border-border/50 border-b px-3 py-3 align-middle medium:px-4";

	return (
		<TableRow className="hover:bg-white/[0.02]" rowVariants={rowVariants}>
			<td className={cn(commonTd, "min-w-0")}>
				<Link
					href={s.practiceHref}
					className="group/sub block min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
					aria-label={goLabel}
				>
					<div className="truncate text-sm font-medium text-foreground">{s.subjectName}</div>
					<div className="text-xs text-muted-foreground">{meta}</div>
				</Link>
			</td>
			<td className={commonTd}>
				<div className="flex min-w-0 items-center gap-1.5">
					<span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT[visual])} />
					<span
						className={cn("text-xs font-medium uppercase leading-tight tracking-[0.06em]", TEXT[visual])}
					>
						{statusLabel}
					</span>
				</div>
			</td>
			<td className={commonTd}>
				<div className="min-w-0 max-w-sm">
					<div className="mb-0.5 text-xs text-muted-foreground tabular-nums">
						<span className="truncate">{progressLabel}</span>
					</div>
					<div className="h-1.5 w-full min-w-[6rem] overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
						{hasAttempts && coveragePct > 0 ? (
							<div
								className={cn("h-full rounded-full transition-[width]", BAR[visual])}
								style={{ width: `${Math.min(100, Math.max(0, coveragePct))}%` }}
							/>
						) : null}
					</div>
				</div>
			</td>
			<td className={cn(commonTd, "text-right text-sm tabular-nums text-foreground")}>{doneDisplay}</td>
			<td className={cn(commonTd, "text-right text-sm font-medium tabular-nums", scoreClass)}>{scoreDisplay}</td>
			<td className={cn(commonTd, "text-right")}>
				<Link
					href={s.practiceHref}
					aria-label={goLabel}
					className="inline-flex rounded-sm text-gray-500 transition-colors hover:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				>
					<ArrowRightIcon className="size-4" strokeWidth={2} />
				</Link>
			</td>
		</TableRow>
	);
}
