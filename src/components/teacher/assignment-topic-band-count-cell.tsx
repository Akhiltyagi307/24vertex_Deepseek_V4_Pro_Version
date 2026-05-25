"use client";

import Link from "next/link";
import { AlertTriangle, CircleCheck, CircleDot } from "lucide-react";
import { useCallback, useMemo, useRef, type ReactNode } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { TopicTrackerBandStudent } from "@/lib/assignments/teacher-submissions-hub-types";
import { cn } from "@/lib/utils";

import {
	AssignmentTopicBandHoverProvider,
	assignmentTopicBandHoverSurfaceAttr,
	useAssignmentTopicBandHover,
} from "./assignment-topic-band-hover-context";

type BandTone = "bad" | "satisfactory" | "good";

type Props = {
	cellKey: string;
	label: string;
	tone: BandTone;
	students: TopicTrackerBandStudent[];
	subjectId: string | null;
	className?: string;
};

function teacherStudentPerformanceHref(studentId: string, subjectId: string) {
	const base = `/teacher/student-performance/${studentId}/performance`;
	const q = new URLSearchParams({ subject: subjectId });
	return `${base}?${q.toString()}`;
}

function studentInitials(fullName: string): string {
	const parts = fullName.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "?";
	if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
	return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function formatTopicAveragePercent(value: number): string {
	const rounded = Math.round(value * 10) / 10;
	return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

function isWithinHoverSurface(
	target: EventTarget | null,
	triggerEl: HTMLElement | null,
	contentEl: HTMLElement | null,
): boolean {
	if (!(target instanceof Node)) return false;
	if (triggerEl?.contains(target) || contentEl?.contains(target)) return true;
	if (target instanceof Element && target.closest(`[${assignmentTopicBandHoverSurfaceAttr}]`)) return true;
	return false;
}

const TONE_META: Record<
	BandTone,
	{
		icon: typeof AlertTriangle;
		popoverClass: string;
		headerClass: string;
		iconWrapClass: string;
		percentClass: string;
		rowClass: string;
	}
> = {
	bad: {
		icon: AlertTriangle,
		popoverClass: "border-s-4 border-s-destructive border-destructive/35 ring-destructive/15",
		headerClass: "border-destructive/15 bg-destructive/5",
		iconWrapClass: "bg-destructive/10 text-destructive",
		percentClass: "bg-destructive/10 text-destructive",
		rowClass: "border-destructive/20",
	},
	satisfactory: {
		icon: CircleDot,
		popoverClass: "border-s-4 border-s-amber-500/50 border-amber-500/25 ring-amber-500/15",
		headerClass: "border-amber-500/15 bg-amber-500/5",
		iconWrapClass: "bg-amber-500/10 text-amber-800 dark:text-amber-200",
		percentClass: "bg-amber-500/10 text-amber-950 dark:text-amber-100",
		rowClass: "border-amber-500/20",
	},
	good: {
		icon: CircleCheck,
		popoverClass: "border-s-4 border-s-emerald-600/40 border-emerald-600/20 ring-emerald-600/10",
		headerClass: "border-emerald-600/15 bg-emerald-600/5",
		iconWrapClass: "bg-emerald-600/10 text-emerald-800 dark:text-emerald-300",
		percentClass: "bg-emerald-600/10 text-emerald-900 dark:text-emerald-100",
		rowClass: "border-emerald-600/20",
	},
};

export function AssignmentTopicBandCountCell({ cellKey, label, tone, students, subjectId, className }: Props) {
	const count = students.length;
	const { openCellKey, openForCell, closeCell } = useAssignmentTopicBandHover();
	const open = openCellKey === cellKey;
	const triggerRef = useRef<HTMLButtonElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const toneMeta = TONE_META[tone];
	const Icon = toneMeta.icon;

	const sortedStudents = useMemo(
		() =>
			[...students].sort(
				(a, b) => a.averagePercent - b.averagePercent || a.fullName.localeCompare(b.fullName),
			),
		[students],
	);

	const openNow = useCallback(() => {
		openForCell(cellKey);
	}, [cellKey, openForCell]);

	const closeNow = useCallback(() => {
		closeCell(cellKey);
	}, [cellKey, closeCell]);

	const handlePointerLeave = useCallback(
		(event: React.PointerEvent) => {
			if (isWithinHoverSurface(event.relatedTarget, triggerRef.current, contentRef.current)) return;
			closeNow();
		},
		[closeNow],
	);

	const handleFocusOut = useCallback(
		(event: React.FocusEvent) => {
			if (isWithinHoverSurface(event.relatedTarget, triggerRef.current, contentRef.current)) return;
			closeNow();
		},
		[closeNow],
	);

	if (count === 0) {
		return <span className={cn("font-mono tabular-nums", className)}>0</span>;
	}

	return (
		<Popover
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) closeNow();
			}}
		>
			<PopoverTrigger
				ref={triggerRef}
				type="button"
				{...{ [assignmentTopicBandHoverSurfaceAttr]: "" }}
				className={cn(
					"-m-2 inline-flex min-h-9 min-w-9 cursor-default items-center justify-center rounded-md px-2 py-1.5 font-mono tabular-nums",
					"text-foreground underline decoration-dotted decoration-muted-foreground/60 underline-offset-2",
					"hover:text-primary hover:decoration-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
					className,
				)}
				aria-label={`${count} ${count === 1 ? "student" : "students"} in ${label}. Hover for names and scores.`}
				onPointerEnter={openNow}
				onPointerLeave={handlePointerLeave}
				onFocus={openNow}
				onBlur={handleFocusOut}
			>
				{count}
			</PopoverTrigger>
			{open ?
				<PopoverContent
					side="left"
					align="end"
					sideOffset={4}
					className={cn(
						"w-[min(100vw-2rem,19rem)] gap-0 overflow-hidden p-0 ring-1",
						toneMeta.popoverClass,
					)}
					onPointerEnter={openNow}
					onPointerLeave={handlePointerLeave}
				>
					<div ref={contentRef} {...{ [assignmentTopicBandHoverSurfaceAttr]: "" }}>
						<div
							className={cn(
								"flex items-start gap-2.5 border-b px-3.5 py-3",
								toneMeta.headerClass,
							)}
						>
							<span
								className={cn(
									"flex size-8 shrink-0 items-center justify-center rounded-lg",
									toneMeta.iconWrapClass,
								)}
								aria-hidden
							>
								<Icon className="size-4" strokeWidth={2} />
							</span>
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									<p className="text-foreground text-sm font-semibold leading-none tracking-tight">{label}</p>
									<Badge
										variant="secondary"
										className="h-5 shrink-0 border-border/80 bg-background/80 px-1.5 font-mono text-[10px] tabular-nums"
									>
										{count}
									</Badge>
								</div>
								<p className="mt-1.5 text-muted-foreground text-[11px] leading-snug">
									Topic score from this assignment&apos;s graded test.
								</p>
							</div>
						</div>
						<ul
							className="max-h-[min(18rem,50dvh)] space-y-1 overflow-y-auto p-2"
							aria-label={`${count} ${count === 1 ? "student" : "students"} in ${label}`}
						>
							{sortedStudents.map((student) => (
								<li
									key={student.studentId}
									className={cn(
										"flex items-center gap-2.5 rounded-lg border bg-muted/20 px-2.5 py-2 dark:bg-muted/10",
										toneMeta.rowClass,
									)}
								>
									<Avatar size="sm" className="size-7 after:border-border/80">
										<AvatarFallback className="bg-muted/80 text-[10px] font-medium text-muted-foreground">
											{studentInitials(student.fullName)}
										</AvatarFallback>
									</Avatar>
									{subjectId ?
										<Link
											href={teacherStudentPerformanceHref(student.studentId, subjectId)}
											className="group/student min-w-0 flex-1 truncate rounded-sm text-foreground text-xs font-medium leading-tight outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover hover:text-primary hover:underline hover:underline-offset-2"
											onClick={closeNow}
										>
											{student.fullName}
										</Link>
									:	<span className="min-w-0 flex-1 truncate text-foreground text-xs font-medium leading-tight">
											{student.fullName}
										</span>
									}
									<span
										className={cn(
											"shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-medium tabular-nums",
											toneMeta.percentClass,
										)}
										title={`Topic score ${formatTopicAveragePercent(student.averagePercent)}`}
									>
										{formatTopicAveragePercent(student.averagePercent)}
									</span>
								</li>
							))}
						</ul>
					</div>
				</PopoverContent>
			:	null}
		</Popover>
	);
}

export function AssignmentTopicBandCountCellWrapper({
	children,
	resetKey,
}: {
	children: ReactNode;
	resetKey?: string;
}) {
	return <AssignmentTopicBandHoverProvider resetKey={resetKey}>{children}</AssignmentTopicBandHoverProvider>;
}
