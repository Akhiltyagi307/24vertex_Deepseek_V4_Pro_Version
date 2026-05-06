"use client";

import { cardSurfaceFrameClassName } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
	PRACTICE_DURATION_OPTIONS,
	getPracticeQuestionPlanForSubject,
	isMathematicsSubject,
} from "@/lib/practice";
import type { PracticeDifficulty } from "@/lib/practice/types";
import { cn } from "@/lib/utils";

import { DIFFICULTY_OPTIONS } from "./types";

export type StepConfigProps = {
	difficulty: PracticeDifficulty;
	durationSeconds: number;
	subjectName: string | null;
	onPickDifficulty: (next: PracticeDifficulty) => void;
	onPickDurationSeconds: (seconds: number) => void;
};

export function StepConfig({
	difficulty,
	durationSeconds,
	subjectName,
	onPickDifficulty,
	onPickDurationSeconds,
}: StepConfigProps) {
	const practicePlan = getPracticeQuestionPlanForSubject(durationSeconds, subjectName);
	const mathOnlyMcq = isMathematicsSubject(subjectName);

	return (
		<section
			className={cn(cardSurfaceFrameClassName, "space-y-6 p-5 medium:p-7")}
			aria-labelledby="practice-wizard-step-2-title"
		>
			<header className="space-y-1.5">
				<h2
					id="practice-wizard-step-2-title"
					className="font-semibold text-foreground text-xl tracking-tight medium:text-[1.375rem]"
				>
					Difficulty &amp; time
				</h2>
				<p className="text-muted-foreground text-sm leading-relaxed medium:text-base">
					Set how hard the questions should feel and how long you have—closer to an exam, or a quick
					sprint.
				</p>
			</header>

			<FieldSet>
				<FieldLegend variant="label" className="text-base">
					Difficulty
				</FieldLegend>
				<FieldGroup data-slot="radio-group" className="gap-4">
					{DIFFICULTY_OPTIONS.map(([value, label]) => (
						<Field key={value} orientation="horizontal">
							<input
								type="radio"
								name="difficulty"
								id={`diff-${value}`}
								checked={difficulty === value}
								onChange={() => onPickDifficulty(value)}
								className="size-5 border-input"
							/>
							<FieldLabel htmlFor={`diff-${value}`}>
								<Label className="text-base" htmlFor={`diff-${value}`}>
									{label}
								</Label>
							</FieldLabel>
						</Field>
					))}
				</FieldGroup>
			</FieldSet>

			<Separator />

			<FieldSet>
				<FieldLegend variant="label" className="text-base">
					Time limit
				</FieldLegend>
				<FieldGroup data-slot="radio-group" className="flex flex-wrap gap-3">
					{PRACTICE_DURATION_OPTIONS.map((opt) => (
						<Field key={opt.seconds} orientation="horizontal">
							<input
								type="radio"
								name="duration"
								id={`dur-${opt.seconds}`}
								checked={durationSeconds === opt.seconds}
								onChange={() => onPickDurationSeconds(opt.seconds)}
								className="size-5 border-input"
							/>
							<FieldLabel htmlFor={`dur-${opt.seconds}`}>
								<Label className="text-base" htmlFor={`dur-${opt.seconds}`}>
									{opt.label}
								</Label>
							</FieldLabel>
						</Field>
					))}
				</FieldGroup>
			</FieldSet>

			<Separator />

			<FieldSet>
				<FieldLegend variant="label" className="text-base">
					Question mix
				</FieldLegend>
				{mathOnlyMcq ? (
					<p className="text-foreground text-sm leading-relaxed">
						<span className="font-medium tabular-nums">{practicePlan.total}</span> multiple-choice
						questions.
					</p>
				) : (
					<p className="text-foreground text-sm leading-relaxed">
						<span className="font-medium tabular-nums">{practicePlan.total}</span> questions:{" "}
						<span className="tabular-nums">{practicePlan.counts.multiple_choice}</span> multiple choice,{" "}
						<span className="tabular-nums">{practicePlan.counts.fill_in_blank}</span> fill-in-the-blank,{" "}
						<span className="tabular-nums">{practicePlan.counts.short_answer}</span> short answer,{" "}
						<span className="tabular-nums">{practicePlan.counts.long_answer}</span> long answer.
					</p>
				)}
				<p className="text-muted-foreground text-sm">
					{mathOnlyMcq
						? "Math practice tests are graded as multiple choice across all grades for fast, predictable feedback."
						: "For each time limit, we pick a set number and mix of question types (MCQ, short, long, and so on)."}
				</p>
			</FieldSet>
		</section>
	);
}
