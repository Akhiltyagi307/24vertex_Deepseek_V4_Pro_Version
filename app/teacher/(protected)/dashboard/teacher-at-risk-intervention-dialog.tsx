"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2Icon, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import type { AtRiskInterventionPlan } from "@/lib/teachers/teacher-at-risk-intervention";
import {
	planAtRiskInterventionAction,
	publishAtRiskInterventionAction,
} from "./at-risk-intervention-actions";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	studentId: string;
	studentName: string;
	subjectId: string | "all";
	riskSummary: string;
};

type Phase =
	| { kind: "loading" }
	| { kind: "error"; message: string }
	| { kind: "ready"; plan: AtRiskInterventionPlan }
	| { kind: "published"; assignmentId: string };

type Difficulty = "easy" | "medium" | "hard";

const inputClass =
	"w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-[border-color,box-shadow] duration-150 ease-out focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/45";

export function TeacherAtRiskInterventionDialog({
	open,
	onOpenChange,
	studentId,
	studentName,
	subjectId,
	riskSummary,
}: Props) {
	const [phase, setPhase] = useState<Phase>({ kind: "loading" });
	const [title, setTitle] = useState("");
	const [difficulty, setDifficulty] = useState<Difficulty>("medium");
	const [publishing, setPublishing] = useState(false);
	const [publishError, setPublishError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		void (async () => {
			setPhase({ kind: "loading" });
			setPublishError(null);
			setPublishing(false);
			try {
				const res = await planAtRiskInterventionAction({ studentId, subjectId, studentName, riskSummary });
				if (cancelled) return;
				if ("error" in res) {
					setPhase({ kind: "error", message: res.error });
					return;
				}
				setPhase({ kind: "ready", plan: res.plan });
				setTitle(res.plan.suggestedTitle);
				setDifficulty(res.plan.suggestedDifficulty);
			} catch {
				if (cancelled) return;
				setPhase({ kind: "error", message: "Could not prepare an intervention. Try again." });
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [open, studentId, subjectId, studentName, riskSummary]);

	const publish = async () => {
		if (phase.kind !== "ready" || title.trim().length === 0) return;
		setPublishing(true);
		setPublishError(null);
		try {
			const res = await publishAtRiskInterventionAction({
				studentId,
				subjectId: phase.plan.subjectId,
				topicIds: phase.plan.focusTopics.map((topic) => topic.topicId),
				title: title.trim(),
				difficulty,
				dueAt: null,
			});
			if (!res.ok) {
				setPublishError(res.message);
				setPublishing(false);
				return;
			}
			setPhase({ kind: "published", assignmentId: res.assignmentId });
			setPublishing(false);
		} catch {
			setPublishError("Could not publish. Try again.");
			setPublishing(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg gap-0 p-0" showCloseButton>
				{phase.kind === "published" ? (
					<>
						<DialogHeader className="space-y-4 border-border border-b px-6 py-6 text-left">
							<div
								className="flex size-12 items-center justify-center rounded-full bg-primary/12 text-primary dark:bg-primary/16"
								aria-hidden
							>
								<CheckCircle2Icon className="size-6" />
							</div>
							<div className="space-y-2">
								<DialogTitle className="text-xl tracking-tight">Intervention published</DialogTitle>
								<DialogDescription className="text-sm leading-relaxed">
									<span className="font-medium text-foreground">{title.trim()}</span> is assigned to{" "}
									{studentName}. Their generated test usually appears within a few minutes.
								</DialogDescription>
							</div>
						</DialogHeader>
						<DialogFooter className="flex-col gap-2 px-6 py-5 medium:flex-col medium:items-stretch">
							<Button render={<Link href="/teacher/submissions?tab=ongoing" />} nativeButton={false}>
								View submissions
							</Button>
							<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
								Done
							</Button>
						</DialogFooter>
					</>
				) : (
					<>
						<DialogHeader className="space-y-3 border-border border-b px-6 py-5 text-left">
							<div className="flex items-center gap-2.5">
								<span
									className="flex size-8 items-center justify-center rounded-lg bg-primary/12 text-primary dark:bg-primary/16"
									aria-hidden
								>
									<Sparkles className="size-4" />
								</span>
								<DialogTitle className="text-lg tracking-tight">Plan an intervention</DialogTitle>
							</div>
							<DialogDescription className="text-sm leading-relaxed">
								A focused remedial practice test for {studentName}, drawn from their weakest topics.
							</DialogDescription>
						</DialogHeader>

						<div className="max-h-[60vh] space-y-5 overflow-y-auto px-6 py-5">
							{phase.kind === "loading" ? (
								<div className="flex items-center gap-2 text-muted-foreground text-sm" role="status">
									<Loader2 className="size-4 animate-spin" aria-hidden />
									Analysing this student&apos;s weak topics…
								</div>
							) : null}

							{phase.kind === "error" ? (
								<p className="text-destructive text-sm" role="alert">
									{phase.message}
								</p>
							) : null}

							{phase.kind === "ready" ? (
								<>
									<div className="rounded-lg border border-border/60 bg-muted/15 px-3 py-3 dark:bg-muted/10">
										<p className="font-medium text-foreground text-xs uppercase tracking-wide text-muted-foreground">
											Why {studentName} is at risk
										</p>
										<p className="mt-1.5 text-foreground text-sm leading-normal">{phase.plan.diagnosis}</p>
									</div>

									<div className="space-y-2">
										<p className="font-medium text-foreground text-sm">
											Focus topics · {phase.plan.subjectName}
										</p>
										<ul className="divide-y divide-border rounded-lg border border-border/60 text-sm" role="list">
											{phase.plan.focusTopics.map((topic) => (
												<li
													key={topic.topicId}
													className="flex items-center justify-between gap-3 px-3 py-2"
												>
													<span className="min-w-0 truncate text-foreground">{topic.topicName}</span>
													<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
														avg {topic.averagePercent}%
													</span>
												</li>
											))}
										</ul>
									</div>

									<div className="grid gap-4 medium:grid-cols-[1fr_auto]">
										<label className="block space-y-1.5">
											<span className="font-medium text-foreground text-sm">Assignment title</span>
											<input
												value={title}
												onChange={(event) => setTitle(event.target.value)}
												maxLength={300}
												className={inputClass}
											/>
										</label>
										<label className="block space-y-1.5">
											<span className="font-medium text-foreground text-sm">Difficulty</span>
											<NativeSelect
												value={difficulty}
												onChange={(event) => setDifficulty(event.target.value as Difficulty)}
												className={cn(inputClass, "medium:w-32")}
											>
												<option value="easy">Easy</option>
												<option value="medium">Medium</option>
												<option value="hard">Hard</option>
											</NativeSelect>
										</label>
									</div>

									<p className="text-muted-foreground text-xs leading-normal">
										Publishes a 15-question, 1-hour practice test for {studentName}. AI-suggested — review
										before publishing.
									</p>

									{publishError ? (
										<p className="text-destructive text-sm" role="alert">
											{publishError}
										</p>
									) : null}
								</>
							) : null}
						</div>

						<DialogFooter className="gap-2 border-border border-t px-6 py-4">
							<Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={publishing}>
								Cancel
							</Button>
							<Button
								type="button"
								onClick={publish}
								disabled={phase.kind !== "ready" || publishing || title.trim().length === 0}
								className="gap-2"
							>
								{publishing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
								{publishing ? "Publishing…" : "Publish intervention"}
							</Button>
						</DialogFooter>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
