"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { useReducedMotion } from "motion/react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateMediumInAppTimeZone, formatDateTimeMediumShortInAppTimeZone } from "@/lib/datetime/app-timezone";
import { cn } from "@/lib/utils";
import { parseScoreNumber, type StudentReportTestRowSerialized } from "@/lib/student/subject-test-report";

export function reportPdfPath(testId: string) {
	return `/api/student/reports/${encodeURIComponent(testId)}/pdf`;
}

export function rowTimestamp(r: StudentReportTestRowSerialized): number {
	const raw = r.testDate ?? r.createdAt;
	if (!raw) return 0;
	const t = new Date(raw).getTime();
	return Number.isFinite(t) ? t : 0;
}

/** Avoid mixing host/Browser local tz; all clocks use Asia/Kolkata. */
export function formatReportTableDateTime(raw: string): string {
	const d = new Date(raw);
	if (!Number.isFinite(d.getTime())) return "—";
	return formatDateTimeMediumShortInAppTimeZone(raw);
}

export function formatReportSummaryDate(raw: number): string {
	const d = new Date(raw);
	if (!Number.isFinite(d.getTime())) return "—";
	return formatDateMediumInAppTimeZone(d);
}

function ReportStatTileCompact({
	Icon,
	iconClassName,
	label,
	value,
	hint,
}: {
	Icon: LucideIcon;
	iconClassName: string;
	label: string;
	value: React.ReactNode;
	hint: string;
}) {
	return (
		<Card size="sm" className="shadow-none gap-0 py-0">
			<CardContent className="space-y-1 p-3">
				<div className="flex items-start justify-between gap-2">
					<div className="flex min-w-0 flex-1 items-center gap-1.5">
						<Icon className={cn("size-4 shrink-0", iconClassName)} strokeWidth={2} aria-hidden />
						<span className="min-w-0 truncate text-xs font-medium leading-tight text-foreground">{label}</span>
					</div>
					<div className="min-w-0 max-w-[52%] shrink-0 text-right font-semibold leading-tight text-foreground">
						{value}
					</div>
				</div>
				<p className="text-pretty text-muted-foreground text-[0.625rem] leading-snug">{hint}</p>
			</CardContent>
		</Card>
	);
}

function ReportStatTileFull({
	Icon,
	iconClassName,
	label,
	hint,
	value,
	valueClassName,
}: {
	Icon: LucideIcon;
	iconClassName: string;
	label: string;
	hint: string;
	value: React.ReactNode;
	valueClassName?: string;
}) {
	return (
		<Card className="shadow-none">
			<CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
				<CardTitle className="min-w-0 flex-1 text-sm font-semibold leading-snug">{label}</CardTitle>
				<Icon className={cn("size-8 shrink-0", iconClassName)} strokeWidth={2} aria-hidden />
			</CardHeader>
			<CardContent>
				<p className={cn("font-semibold text-2xl tabular-nums", valueClassName)}>{value}</p>
				<p className="text-muted-foreground text-xs">{hint}</p>
			</CardContent>
		</Card>
	);
}

export function ReportStatResponsive({
	Icon,
	iconClassName,
	label,
	hint,
	compactValue,
	fullValue,
	fullValueClassName,
}: {
	Icon: LucideIcon;
	iconClassName: string;
	label: string;
	hint: string;
	compactValue: React.ReactNode;
	fullValue: React.ReactNode;
	fullValueClassName?: string;
}) {
	return (
		<>
			<div className="medium:hidden">
				<ReportStatTileCompact
					Icon={Icon}
					iconClassName={iconClassName}
					label={label}
					value={compactValue}
					hint={hint}
				/>
			</div>
			<div className="hidden medium:block">
				<ReportStatTileFull
					Icon={Icon}
					iconClassName={iconClassName}
					label={label}
					hint={hint}
					value={fullValue}
					valueClassName={fullValueClassName}
				/>
			</div>
		</>
	);
}

export function scoreForAverage(r: StudentReportTestRowSerialized): number | null {
	const s = parseScoreNumber(r.totalScore);
	if (s == null) return null;
	if (r.status === "graded") return s;
	if (r.status === "submitted") return s;
	return null;
}

export function useReportsStaggerVariants() {
	const reduceMotion = useReducedMotion();
	const y = reduceMotion ? 0 : 10;
	const stagger = reduceMotion ? 0 : 0.05;
	const duration = reduceMotion ? 0 : 0.24;

	const container = React.useMemo(
		() => ({
			hidden: {},
			show: {
				transition: { staggerChildren: stagger, delayChildren: reduceMotion ? 0 : 0.02 },
			},
		}),
		[reduceMotion, stagger],
	);

	const item = React.useMemo(
		() => ({
			hidden: { opacity: reduceMotion ? 1 : 0, y },
			show: {
				opacity: 1,
				y: 0,
				transition: { duration, ease: "easeOut" as const },
			},
		}),
		[duration, reduceMotion, y],
	);

	return { container, item };
}
