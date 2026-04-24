"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { PublicGenerationMetadata, PublicPracticeQuestion } from "@/lib/practice";
import { cn } from "@/lib/utils";

function questionTypeLabel(t: PublicPracticeQuestion["question_type"] | string): string {
	switch (t) {
		case "multiple_choice":
			return "Multiple choice";
		case "fill_in_blank":
			return "Fill in the blank";
		case "short_answer":
			return "Short answer";
		case "long_answer":
			return "Long answer";
		case "numerical":
			return "Numerical";
		default:
			return String(t).replace(/_/g, " ");
	}
}

function difficultyBadgeClass(d: PublicPracticeQuestion["difficulty_level"]): string {
	if (d === "hard") return "border-destructive/40 bg-destructive/10 text-destructive";
	if (d === "easy") return "border-emerald-600/35 bg-emerald-600/10 text-emerald-800 dark:text-emerald-200";
	return "border-border bg-muted/60 text-foreground";
}

export type PracticeGeneratedTestViewProps = {
	subjectName: string | null;
	difficultyLabel: string;
	durationLabel: string;
	questions: PublicPracticeQuestion[];
	generation_metadata: PublicGenerationMetadata;
	className?: string;
};

export function PracticeGeneratedTestView({
	subjectName,
	difficultyLabel,
	durationLabel,
	questions,
	generation_metadata,
	className,
}: PracticeGeneratedTestViewProps) {
	const sorted = React.useMemo(
		() => [...questions].sort((a, b) => a.question_number - b.question_number),
		[questions],
	);

	const optionEntries = (q: PublicPracticeQuestion) => {
		if (!q.options) return [];
		return Object.entries(q.options)
			.map(([k, v]) => [k.trim().toUpperCase(), v] as const)
			.sort(([a], [b]) => a.localeCompare(b));
	};

	return (
		<div className={cn("space-y-6", className)}>
			<Card className="overflow-hidden border-emerald-600/25 bg-gradient-to-br from-card via-card to-emerald-600/[0.06] dark:border-emerald-500/25 dark:to-emerald-500/[0.07]">
				<CardHeader className="pb-2">
					<CardTitle className="text-xl font-semibold tracking-tight">Your practice test</CardTitle>
					<CardDescription className="text-base leading-relaxed">
						{subjectName ? (
							<span className="text-foreground font-medium">{subjectName}</span>
						) : (
							"Practice test"
						)}
						<span className="text-muted-foreground">
							{" "}
							· {sorted.length} questions · {difficultyLabel} · {durationLabel}
						</span>
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3 pt-0">
					<p className="text-muted-foreground text-sm leading-relaxed">
						{generation_metadata.adaptation_rationale}
					</p>
					<div className="flex flex-wrap gap-2">
						{Object.entries(generation_metadata.type_distribution).map(([k, n]) => (
							<Badge key={k} variant="outline" className="font-normal tabular-nums">
								{questionTypeLabel(k as PublicPracticeQuestion["question_type"])}: {n}
							</Badge>
						))}
					</div>
				</CardContent>
			</Card>

			<div className="space-y-4">
				{sorted.map((q) => (
					<Card
						key={`${q.question_number}-${q.topic_id}`}
						className="border-border/80 shadow-sm transition-[box-shadow,border-color] duration-200 hover:border-emerald-600/20 hover:shadow-[0_0_24px_-12px_color-mix(in_oklab,var(--color-emerald-600)_28%,transparent)] dark:hover:border-emerald-500/25"
					>
						<CardHeader className="space-y-3 pb-3">
							<div className="flex flex-wrap items-center gap-2">
								<Badge variant="secondary" className="font-mono tabular-nums">
									Q{q.question_number}
								</Badge>
								<Badge variant="outline" className={cn("font-medium", difficultyBadgeClass(q.difficulty_level))}>
									{q.difficulty_level.charAt(0).toUpperCase() + q.difficulty_level.slice(1)}
								</Badge>
								<Badge variant="outline" className="font-normal">
									{questionTypeLabel(q.question_type)}
								</Badge>
								<span className="text-muted-foreground ml-auto text-xs tabular-nums">
									~{q.estimated_time_seconds}s
								</span>
							</div>
							<CardTitle className="text-base font-medium leading-snug text-foreground">
								{q.question_text}
							</CardTitle>
							<CardDescription className="text-sm font-medium text-muted-foreground">
								{q.topic_name}
							</CardDescription>
						</CardHeader>
						{q.question_type === "multiple_choice" && q.options ?
							<>
								<Separator />
								<CardContent className="pt-4">
									<p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
										Options
									</p>
									<ul className="space-y-2">
										{optionEntries(q).map(([letter, text]) => (
											<li
												key={letter}
												className="flex gap-3 rounded-lg border border-border bg-muted/25 px-3 py-2.5 text-sm leading-snug"
											>
												<span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-emerald-600/35 bg-emerald-600/10 font-mono text-xs font-semibold text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/12 dark:text-emerald-200">
													{letter}
												</span>
												<span className="text-foreground pt-0.5">{text}</span>
											</li>
										))}
									</ul>
								</CardContent>
							</>
						:	null}
						{q.question_type !== "multiple_choice" ?
							<>
								<Separator />
								<CardContent className="pt-4">
									<p className="text-muted-foreground text-sm leading-relaxed">
										This preview shows the prompt only. Written-response and numerical questions are fully
										graded after you open the live test session.
									</p>
								</CardContent>
							</>
						:	null}
					</Card>
				))}
			</div>
		</div>
	);
}
