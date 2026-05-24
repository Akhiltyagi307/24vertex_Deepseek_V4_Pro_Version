import Link from "next/link";
import {
	CheckCircle2Icon,
	ClipboardListIcon,
	ListTodoIcon,
	LoaderCircleIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cardSurfaceFrameClassName } from "@/components/ui/card";
import { studentAssignmentCardHref } from "@/lib/assignments/assignment-card-links";
import type { StudentAssignmentCard } from "@/lib/assignments/student-assignment-card";
import { classifyAssignmentUrgency, type AssignmentUrgency } from "@/lib/student/dashboard-open-assignments";
import { cn } from "@/lib/utils";

type AssignmentsKanbanProps = {
	assignments: StudentAssignmentCard[];
	portal: "student" | "parent";
};

const columns = [
	{
		id: "todo",
		title: "To do",
		description: "Not started yet. Open when the test is ready.",
		emptyTitle: "Nothing to start",
		emptyBody: "New teacher assignments land here when they are ready.",
		statuses: ["pending_materialize", "ready", "failed_generation"],
		icon: ListTodoIcon,
	},
	{
		id: "progress",
		title: "In progress",
		description: "You have started but not submitted.",
		emptyTitle: "Nothing in progress",
		emptyBody: "Tests you begin stay here until you submit.",
		statuses: ["in_progress"],
		icon: LoaderCircleIcon,
	},
	{
		id: "graded",
		title: "Graded",
		description: "Submitted, grading, and finished tests.",
		emptyTitle: "Nothing submitted yet",
		emptyBody: "After you submit, work moves here until grading finishes.",
		statuses: ["submitted", "grading", "grading_failed", "late", "graded"],
		icon: CheckCircle2Icon,
	},
] as const;

type ColumnId = (typeof columns)[number]["id"];

function statusLabel(status: string): string {
	switch (status) {
		case "pending_materialize":
			return "Preparing";
		case "ready":
			return "Ready";
		case "in_progress":
			return "In progress";
		case "submitted":
			return "Submitted";
		case "grading":
			return "Grading";
		case "graded":
			return "Graded";
		case "failed_generation":
			return "Needs retry";
		case "grading_failed":
			return "Grading issue";
		case "late":
			return "Late";
		default:
			return status.replaceAll("_", " ");
	}
}

function statusBadgeClassName(status: string): string {
	switch (status) {
		case "ready":
			return "border-primary/25 bg-primary/10 text-foreground";
		case "in_progress":
			return "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100";
		case "pending_materialize":
		case "grading":
			return "border-border bg-muted/60 text-muted-foreground";
		case "submitted":
		case "graded":
			return "border-primary/20 bg-primary/10 text-foreground";
		case "failed_generation":
		case "grading_failed":
		case "late":
			return "border-destructive/30 bg-destructive/10 text-destructive";
		default:
			return "border-border bg-muted/50 text-muted-foreground";
	}
}

function dueDateLabel(dueAt: string | null): string {
	if (!dueAt) return "No due date";
	try {
		return new Date(dueAt).toLocaleDateString(undefined, {
			month: "short",
			day: "numeric",
			weekday: "short",
		});
	} catch {
		return "No due date";
	}
}

function urgencyDueClass(urgency: AssignmentUrgency): string {
	switch (urgency) {
		case "overdue":
			return "text-destructive font-medium";
		case "due_soon":
			return "font-medium text-amber-700 dark:text-amber-300";
		default:
			return "text-muted-foreground";
	}
}

function urgencyPrefix(urgency: AssignmentUrgency): string | null {
	switch (urgency) {
		case "overdue":
			return "Overdue";
		case "due_soon":
			return "Due soon";
		default:
			return null;
	}
}

function sortCardsForColumn(columnId: ColumnId, cards: StudentAssignmentCard[]): StudentAssignmentCard[] {
	const copy = [...cards];
	if (columnId === "graded") {
		copy.sort((a, b) => {
			const aTime = Date.parse(a.gradedAt ?? a.submittedAt ?? a.createdAt ?? "") || 0;
			const bTime = Date.parse(b.gradedAt ?? b.submittedAt ?? b.createdAt ?? "") || 0;
			return bTime - aTime;
		});
		return copy;
	}
	copy.sort((a, b) => {
		const urgencyA = classifyAssignmentUrgency(a.dueAt);
		const urgencyB = classifyAssignmentUrgency(b.dueAt);
		const rank = (u: AssignmentUrgency) => {
			switch (u) {
				case "overdue":
					return 0;
				case "due_soon":
					return 1;
				case "on_track":
					return 2;
				case "no_due":
					return 3;
			}
		};
		const byUrgency = rank(urgencyA) - rank(urgencyB);
		if (byUrgency !== 0) return byUrgency;
		if (a.dueAt && b.dueAt) {
			return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
		}
		if (a.dueAt) return -1;
		if (b.dueAt) return 1;
		const createdA = Date.parse(a.createdAt ?? "") || 0;
		const createdB = Date.parse(b.createdAt ?? "") || 0;
		return createdB - createdA;
	});
	return copy;
}

function AssignmentKanbanCard({
	card,
	portal,
	showDueUrgency,
}: {
	card: StudentAssignmentCard;
	portal: "student" | "parent";
	showDueUrgency: boolean;
}) {
	const href = studentAssignmentCardHref(card, portal);
	const urgency = classifyAssignmentUrgency(card.dueAt);
	const urgencyLabel = urgencyPrefix(urgency);
	const score =
		card.score != null && card.lifecycleStatus === "graded"
			? `${Number(card.score).toFixed(1)}%`
			: null;

	const surface = (
		<article
			className={cn(
				cardSurfaceFrameClassName,
				"flex flex-col gap-3 p-4 shadow-none",
				href && "hover:border-primary/30",
			)}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<h3 className="truncate text-sm font-semibold leading-snug text-foreground">{card.title}</h3>
					<p className="mt-1 text-xs text-muted-foreground">{card.subjectName ?? "Practice test"}</p>
				</div>
				<Badge
					variant="outline"
					className={cn("h-5 shrink-0 px-2 text-[11px] font-medium", statusBadgeClassName(card.lifecycleStatus))}
				>
					{statusLabel(card.lifecycleStatus)}
				</Badge>
			</div>
			{card.instructions ? (
				<p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{card.instructions}</p>
			) : null}
			<div className="flex items-end justify-between gap-3 text-xs">
				<div className="min-w-0">
					{showDueUrgency ? (
						<p className={cn("tabular-nums", urgencyDueClass(urgency))}>
							{urgencyLabel ? (
								<span className="mr-1">{urgencyLabel} ·</span>
							) : null}
							<span>{dueAtLine(card.dueAt)}</span>
						</p>
					) : (
						<p className="text-muted-foreground tabular-nums">{dueAtLine(card.dueAt)}</p>
					)}
					{!href && portal === "student" ? (
						<p className="mt-1 text-[11px] text-muted-foreground">Opens when the test is ready</p>
					) : null}
				</div>
				{score ? (
					<span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground">
						{score}
					</span>
				) : null}
			</div>
		</article>
	);

	if (!href) {
		return <li className="list-none">{surface}</li>;
	}

	return (
		<li className="list-none">
			<Link
				href={href}
				className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
			>
				{surface}
			</Link>
		</li>
	);
}

function dueAtLine(dueAt: string | null): string {
	if (!dueAt) return "No due date";
	return `Due ${dueDateLabel(dueAt)}`;
}

function KanbanColumn({
	column,
	cards,
	portal,
}: {
	column: (typeof columns)[number];
	cards: StudentAssignmentCard[];
	portal: "student" | "parent";
}) {
	const Icon = column.icon;
	const sorted = sortCardsForColumn(column.id, cards);
	const showDueUrgency = column.id === "todo" || column.id === "progress";
	const headerId = `assignments-column-${column.id}`;

	return (
		<section
			className="flex min-h-0 min-w-0 flex-col rounded-xl border border-border/70 bg-muted/20"
			aria-labelledby={headerId}
		>
			<header className="border-b border-border/60 px-4 py-3.5">
				<div className="flex items-start justify-between gap-3">
					<div className="flex min-w-0 items-start gap-2.5">
						<span
							className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-background/80 text-muted-foreground ring-1 ring-foreground/10"
							aria-hidden
						>
							<Icon className="size-4" strokeWidth={2} />
						</span>
						<div className="min-w-0">
							<h2 id={headerId} className="text-sm font-semibold tracking-tight text-foreground">
								{column.title}
							</h2>
							<p className="mt-0.5 text-xs leading-snug text-muted-foreground">{column.description}</p>
						</div>
					</div>
					<Badge variant="secondary" className="h-5 min-w-5 shrink-0 px-2 font-mono text-[11px] tabular-nums">
						{sorted.length}
					</Badge>
				</div>
			</header>
			<div className="flex flex-1 flex-col p-3">
				{sorted.length === 0 ? (
					<div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border/70 bg-background/50 px-4 py-10 text-center">
						<p className="text-sm font-medium text-foreground">{column.emptyTitle}</p>
						<p className="mt-1.5 max-w-[16rem] text-xs leading-relaxed text-muted-foreground">
							{column.emptyBody}
						</p>
					</div>
				) : (
					<ul className="flex flex-col gap-2.5" aria-label={`${column.title} assignments`}>
						{sorted.map((card) => (
							<AssignmentKanbanCard
								key={card.id}
								card={card}
								portal={portal}
								showDueUrgency={showDueUrgency}
							/>
						))}
					</ul>
				)}
			</div>
		</section>
	);
}

export function AssignmentsKanban({ assignments, portal }: AssignmentsKanbanProps) {
	const isStudent = portal === "student";

	if (assignments.length === 0) {
		return (
			<div
				className={cn(
					cardSurfaceFrameClassName,
					"flex flex-col items-center px-6 py-14 text-center shadow-none",
				)}
			>
				<ClipboardListIcon
					className="size-11 text-muted-foreground/75"
					strokeWidth={1.5}
					aria-hidden
				/>
				<p className="mt-4 text-base font-semibold text-foreground">
					{isStudent ? "No assignments yet" : "No assignments for your child"}
				</p>
				<p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
					{isStudent
						? "When a teacher publishes a practice test for your class, it will show up here in three steps: to do, in progress, and graded."
						: "When their teacher publishes practice tests, you can follow progress here from start to graded."}
				</p>
				{isStudent ? (
					<Button variant="outline" className="mt-6" render={<Link href="/student/practice" />}>
						Go to practice
					</Button>
				) : null}
			</div>
		);
	}

	return (
		<div className="flex w-full min-w-0 flex-col gap-5">
			<div
				className="grid w-full min-w-0 grid-cols-1 gap-5 xl:grid-cols-3 xl:gap-4"
				role="region"
				aria-label={isStudent ? "Your assignments board" : "Assignments board"}
			>
				{columns.map((column) => {
					const cards = assignments.filter((assignment) =>
						(column.statuses as readonly string[]).includes(assignment.lifecycleStatus),
					);
					return <KanbanColumn key={column.id} column={column} cards={cards} portal={portal} />;
				})}
			</div>
		</div>
	);
}
