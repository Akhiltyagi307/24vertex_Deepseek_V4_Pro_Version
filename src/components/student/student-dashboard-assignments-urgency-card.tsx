import Link from "next/link";
import { ClipboardListIcon } from "lucide-react";

import { studentAssignmentCardHref } from "@/lib/assignments/assignment-card-links";
import type { StudentAssignmentCard } from "@/lib/assignments/student-assignment-card";
import {
	classifyAssignmentUrgency,
	formatAssignmentsCardTitle,
	formatOpenAssignmentsSummaryLine,
	summarizeOpenAssignments,
	type AssignmentUrgency,
} from "@/lib/student/dashboard-open-assignments";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
	cardSurfaceFrameClassName,
} from "@/components/ui/card";
import {
	dashboardPortalCardClassName,
	dashboardPortalCardContentClassName,
	dashboardPortalCardEmptyClassName,
	dashboardPortalCardPopulatedClassName,
} from "@/lib/student/dashboard-portal-card-layout";
import { cn } from "@/lib/utils";

function statusLabel(status: string): string {
	switch (status) {
		case "pending_materialize":
			return "Preparing test";
		case "ready":
			return "Ready";
		case "in_progress":
			return "In progress";
		case "failed_generation":
			return "Needs retry";
		default:
			return status.replaceAll("_", " ");
	}
}

function dueDateLabel(dueAt: string | null): string {
	if (!dueAt) return "No due date";
	try {
		return `Due ${new Date(dueAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
	} catch {
		return "No due date";
	}
}

function urgencyDueClass(urgency: AssignmentUrgency): string {
	switch (urgency) {
		case "overdue":
			return "text-destructive font-medium";
		case "due_soon":
			return "text-amber-600 dark:text-amber-400 font-medium";
		default:
			return "text-muted-foreground";
	}
}

type StudentDashboardAssignmentsUrgencyCardProps = {
	assignments: StudentAssignmentCard[];
	variant: "student" | "parent";
};

export function StudentDashboardAssignmentsUrgencyCard({
	assignments,
	variant,
}: StudentDashboardAssignmentsUrgencyCardProps) {
	const isParent = variant === "parent";
	const portal = variant;
	const assignmentsHref = isParent ? "/parent/assignments" : "/student/assignments";
	const summary = summarizeOpenAssignments(assignments);
	const summaryLine = formatOpenAssignmentsSummaryLine(summary, variant);
	const cardTitle = formatAssignmentsCardTitle(summary, assignments.length > 0, variant);
	const hasOpen = assignments.length > 0;

	return (
		<Card
			className={cn(
				cardSurfaceFrameClassName,
				dashboardPortalCardClassName,
				hasOpen && dashboardPortalCardPopulatedClassName,
				"w-full",
			)}
		>
			<CardHeader className="px-5 pb-3">
				<CardTitle className="flex items-center gap-2.5 text-base font-semibold leading-snug">
					<ClipboardListIcon
						className="size-5 shrink-0 text-sky-600 dark:text-sky-400"
						strokeWidth={2}
						aria-hidden
					/>
					{cardTitle}
				</CardTitle>
				<CardDescription className="text-sm leading-snug tabular-nums">{summaryLine}</CardDescription>
			</CardHeader>
			<CardContent className={dashboardPortalCardContentClassName}>
				{!hasOpen ? (
					<div className={dashboardPortalCardEmptyClassName}>
						<ClipboardListIcon
							className="size-10 text-muted-foreground/70"
							strokeWidth={1.5}
							aria-hidden
						/>
						<p className="max-w-xs text-sm text-muted-foreground">
							{isParent
								? "They're all caught up on teacher assignments."
								: "You're all caught up on teacher assignments."}
						</p>
						{!isParent ? (
							<Button variant="outline" render={<Link href="/student/practice" />}>
								Start practice
							</Button>
						) : null}
					</div>
				) : (
					<ul className="min-h-[220px] max-h-[min(420px,55vh)] flex-1 space-y-2.5 overflow-y-auto pr-1">
						{assignments.map((card) => {
							const href = studentAssignmentCardHref(card, portal);
							const urgency = classifyAssignmentUrgency(card.dueAt);
							const row = (
								<div
									className={cn(
										"rounded-lg bg-muted/25 px-4 py-3 transition-colors",
										href ? "hover:bg-muted/40" : "opacity-90",
									)}
								>
									<div className="flex items-start justify-between gap-2">
										<div className="min-w-0">
											<p className="truncate text-sm font-semibold">{card.title}</p>
											<p className="mt-0.5 text-xs text-muted-foreground">
												{card.subjectName ?? "Practice test"}
											</p>
										</div>
										<span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
											{statusLabel(card.lifecycleStatus)}
										</span>
									</div>
									<p className={cn("mt-2 text-xs", urgencyDueClass(urgency))}>
										{urgency === "overdue" ? "Overdue · " : urgency === "due_soon" ? "Due soon · " : null}
										{dueDateLabel(card.dueAt)}
									</p>
									{!href ? (
										<p className="mt-1 text-[10px] text-muted-foreground">Not ready yet</p>
									) : null}
								</div>
							);
							return (
								<li key={card.id}>
									{href ? (
										<Link
											href={href}
											className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
										>
											{row}
										</Link>
									) : (
										<div aria-disabled="true">{row}</div>
									)}
								</li>
							);
						})}
					</ul>
				)}
			</CardContent>
			{hasOpen ? (
				<CardFooter className="mt-auto border-t border-border/60 px-5 py-4">
					<Button variant="outline" size="sm" className="w-full" render={<Link href={assignmentsHref} />}>
						View all assignments
					</Button>
				</CardFooter>
			) : null}
		</Card>
	);
}
