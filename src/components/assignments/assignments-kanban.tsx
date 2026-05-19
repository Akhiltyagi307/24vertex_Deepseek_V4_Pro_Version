import Link from "next/link";

import type { StudentAssignmentCard } from "@/lib/assignments/queries";

type AssignmentsKanbanProps = {
	assignments: StudentAssignmentCard[];
	portal: "student" | "parent";
};

const columns = [
	{
		id: "todo",
		title: "To do",
		statuses: ["pending_materialize", "ready", "failed_generation"],
	},
	{
		id: "progress",
		title: "In progress",
		statuses: ["in_progress"],
	},
	{
		id: "review",
		title: "Submitted",
		statuses: ["submitted", "grading", "grading_failed", "late"],
	},
	{
		id: "graded",
		title: "Graded",
		statuses: ["graded"],
	},
] as const;

function statusLabel(status: string): string {
	switch (status) {
		case "pending_materialize":
			return "Generating";
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
			return "Grading failed";
		case "late":
			return "Late";
		default:
			return status.replaceAll("_", " ");
	}
}

function assignmentHref(card: StudentAssignmentCard, portal: "student" | "parent") {
	if (portal === "student" && card.testId && ["ready", "in_progress"].includes(card.lifecycleStatus)) {
		return `/student/practice/${card.testId}`;
	}
	if (portal === "student" && card.testId && card.lifecycleStatus === "graded") {
		return `/student/reports?test=${encodeURIComponent(card.testId)}`;
	}
	if (portal === "student" && card.testId && card.lifecycleStatus === "grading_failed") {
		return `/student/practice/${card.testId}/grading`;
	}
	if (portal === "parent" && card.testId && card.lifecycleStatus === "graded") {
		return `/parent/reports?test=${encodeURIComponent(card.testId)}`;
	}
	return null;
}

export function AssignmentsKanban({ assignments, portal }: AssignmentsKanbanProps) {
	if (assignments.length === 0) {
		return (
			<div className="w-full rounded-2xl border border-dashed border-border/80 bg-muted/15 px-6 py-12 text-center">
				<p className="font-medium">No assignments yet</p>
				<p className="mt-2 text-sm text-muted-foreground">
					Teacher-assigned practice tests will appear here when they are published.
				</p>
			</div>
		);
	}

	return (
		<div className="grid w-full gap-4 xl:grid-cols-4">
			{columns.map((column) => {
				const cards = assignments.filter((assignment) =>
					(column.statuses as readonly string[]).includes(assignment.lifecycleStatus),
				);
				return (
					<section key={column.id} className="rounded-2xl border border-border/80 bg-muted/20 p-3">
						<div className="mb-3 flex items-center justify-between">
							<h2 className="text-sm font-semibold">{column.title}</h2>
							<span className="font-mono text-xs text-muted-foreground tabular-nums">{cards.length}</span>
						</div>
						<div className="space-y-3">
							{cards.length === 0 ? (
								<p className="rounded-xl border border-dashed border-border/70 bg-background/60 px-3 py-6 text-center text-xs text-muted-foreground">
									Nothing here.
								</p>
							) : (
								cards.map((card) => {
									const href = assignmentHref(card, portal);
									const content = (
										<div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm transition-[border-color,box-shadow] hover:border-violet-300 hover:shadow-md">
											<div className="flex items-start justify-between gap-3">
												<div className="min-w-0">
													<h3 className="truncate text-sm font-semibold">{card.title}</h3>
													<p className="mt-1 text-xs text-muted-foreground">{card.subjectName ?? "Practice test"}</p>
												</div>
												<span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
													{statusLabel(card.lifecycleStatus)}
												</span>
											</div>
											{card.instructions ? (
												<p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{card.instructions}</p>
											) : null}
											<div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
												<span>{card.dueAt ? `Due ${new Date(card.dueAt).toLocaleDateString()}` : "No due date"}</span>
												{card.score != null ? (
													<span className="font-mono text-foreground tabular-nums">{Number(card.score).toFixed(1)}%</span>
												) : null}
											</div>
										</div>
									);
									return href ? (
										<Link key={card.id} href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
											{content}
										</Link>
									) : (
										<div key={card.id}>{content}</div>
									);
								})
							)}
						</div>
					</section>
				);
			})}
		</div>
	);
}
