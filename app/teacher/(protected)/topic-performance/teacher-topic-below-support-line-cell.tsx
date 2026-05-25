"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useCallback, useMemo, useRef } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { TeacherTopicBelowSupportLineStudent } from "@/lib/teachers/teacher-topic-performance-queries";
import { cn } from "@/lib/utils";

import {
	belowSupportHoverSurfaceAttr,
	useTeacherTopicBelowSupportLineHover,
} from "./teacher-topic-below-support-line-hover-context";

type Props = {
	topicId: string;
	students: TeacherTopicBelowSupportLineStudent[];
	subjectId: string;
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
	if (target instanceof Element && target.closest(`[${belowSupportHoverSurfaceAttr}]`)) return true;
	return false;
}

export function TeacherTopicBelowSupportLineCell({ topicId, students, subjectId, className }: Props) {
	const count = students.length;
	const { openTopicId, openForTopic, closeTopic } = useTeacherTopicBelowSupportLineHover();
	const open = openTopicId === topicId;
	const triggerRef = useRef<HTMLButtonElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);

	const sortedStudents = useMemo(
		() => [...students].sort((a, b) => a.averagePercent - b.averagePercent || a.fullName.localeCompare(b.fullName)),
		[students],
	);

	const openNow = useCallback(() => {
		openForTopic(topicId);
	}, [openForTopic, topicId]);

	const closeNow = useCallback(() => {
		closeTopic(topicId);
	}, [closeTopic, topicId]);

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
		return <span className={cn("tabular-nums", className)}>0</span>;
	}

	const supportLineLabel = "Below 60%";

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
				{...{ [belowSupportHoverSurfaceAttr]: "" }}
				className={cn(
					"-m-2 inline-flex min-h-9 min-w-9 cursor-default items-center justify-center rounded-md px-2 py-1.5 tabular-nums",
					"text-foreground underline decoration-dotted decoration-muted-foreground/60 underline-offset-2",
					"hover:text-primary hover:decoration-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
					className,
				)}
				aria-label={`${count} ${count === 1 ? "student" : "students"} ${supportLineLabel.toLowerCase()}. Hover for names and scores.`}
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
					className="w-[min(100vw-2rem,19rem)] gap-0 overflow-hidden border-s-4 border-s-destructive border-destructive/35 p-0 ring-1 ring-destructive/15"
					onPointerEnter={openNow}
					onPointerLeave={handlePointerLeave}
				>
					<div ref={contentRef} {...{ [belowSupportHoverSurfaceAttr]: "" }}>
						<div className="flex items-start gap-2.5 border-b border-destructive/15 bg-destructive/5 px-3.5 py-3">
							<span
								className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive"
								aria-hidden
							>
								<AlertTriangle className="size-4" strokeWidth={2} />
							</span>
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									<p className="text-foreground text-sm font-semibold leading-none tracking-tight">
										{supportLineLabel}
									</p>
									<Badge
										variant="secondary"
										className="h-5 shrink-0 border-destructive/20 bg-background/80 px-1.5 font-mono text-[10px] tabular-nums"
									>
										{count}
									</Badge>
								</div>
								<p className="mt-1.5 text-muted-foreground text-[11px] leading-snug">
									Topic average from graded practice on this topic.
								</p>
							</div>
						</div>
						<ul
							className="max-h-[min(18rem,50dvh)] space-y-1 overflow-y-auto p-2"
							aria-label={`${count} ${count === 1 ? "student" : "students"} ${supportLineLabel.toLowerCase()}`}
						>
							{sortedStudents.map((student) => (
								<li
									key={student.studentId}
									className="flex items-center gap-2.5 rounded-lg border border-destructive/20 bg-muted/20 px-2.5 py-2 dark:bg-muted/10"
								>
									<Avatar size="sm" className="size-7 after:border-border/80">
										<AvatarFallback className="bg-muted/80 text-[10px] font-medium text-muted-foreground">
											{studentInitials(student.fullName)}
										</AvatarFallback>
									</Avatar>
									<Link
										href={teacherStudentPerformanceHref(student.studentId, subjectId)}
										className="group/student min-w-0 flex-1 truncate rounded-sm text-foreground text-xs font-medium leading-tight outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover hover:text-primary hover:underline hover:underline-offset-2"
										onClick={closeNow}
									>
										{student.fullName}
									</Link>
									<span
										className="shrink-0 rounded-md bg-destructive/10 px-1.5 py-0.5 font-mono text-destructive text-[11px] font-medium tabular-nums"
										title={`Topic average ${formatTopicAveragePercent(student.averagePercent)}`}
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
