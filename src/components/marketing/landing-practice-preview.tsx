import { Check, CircleDot, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { landingFeatureBentoShell } from "@/lib/marketing/landing-feature-surface";
import { landingMasteryPreviewChipClassNames } from "@/lib/marketing/landing-mastery-preview-styles";
import { landingMarketingSectionEyebrowBadgeClassName } from "@/lib/marketing/landing-marketing-badge";
import { cn } from "@/lib/utils";

/**
 * Product-faithful preview of a 20-minute adaptive practice set: chapter focus
 * row, an in-flight question, and the difficulty / mastery ribbon that shifts
 * as attempts land. Static SSR markup, no client JS.
 */

type AnswerState = "correct" | "incorrect" | "active";
type Difficulty = "easy" | "medium" | "hard";
type FocusState = "active" | "next" | "done";

type FocusChapter = {
	chapter: string;
	state: FocusState;
	difficulty: Difficulty;
};

type AnswerOption = {
	label: string;
	state: AnswerState;
};

const FOCUS_CHAPTERS: ReadonlyArray<FocusChapter> = [
	{ chapter: "Quadrilaterals", state: "done", difficulty: "medium" },
	{ chapter: "Triangles", state: "active", difficulty: "hard" },
	{ chapter: "Coord. geometry", state: "next", difficulty: "medium" },
];

const QUESTION = {
	chapter: "Triangles",
	prompt: "In a triangle ABC, the bisector of angle A meets BC at D. If AB = 8 cm, AC = 6 cm and BD = 4 cm, what is DC?",
	options: [
		{ label: "2 cm", state: "incorrect" as AnswerState },
		{ label: "3 cm", state: "correct" as AnswerState },
		{ label: "4 cm", state: "active" as AnswerState },
		{ label: "5 cm", state: "active" as AnswerState },
	] satisfies ReadonlyArray<AnswerOption>,
	hint: "Angle bisector theorem: BD/DC = AB/AC.",
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
	easy: "Easy",
	medium: "Medium",
	hard: "Hard",
};

const DIFFICULTY_CLASSNAMES: Record<Difficulty, string> = {
	easy: landingMasteryPreviewChipClassNames.green,
	medium: landingMasteryPreviewChipClassNames.amber,
	hard: landingMasteryPreviewChipClassNames.red,
};

const FOCUS_STATE_CLASSNAMES: Record<FocusState, string> = {
	done: "border-border/60 bg-card text-muted-foreground line-through decoration-[1px]",
	active: "border-[var(--subject-grid-icon)]/45 bg-[var(--subject-grid-icon)]/10 text-card-foreground",
	next: "border-dashed border-border/70 bg-transparent text-muted-foreground",
};

function MasteryRibbon({ before, after }: { before: number; after: number }) {
	const delta = after - before;
	const safeBefore = Math.max(0, Math.min(100, before));
	const safeAfter = Math.max(0, Math.min(100, after));

	return (
		<div className="border-border/60 rounded-2xl border bg-muted/30 px-4 py-3.5 medium:px-5">
			<div className="flex items-center justify-between gap-3">
				<div>
					<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--link)] dark:text-[var(--subject-grid-icon)]">
						Triangles mastery
					</p>
					<p className="mt-0.5 text-xs text-muted-foreground">
						Difficulty stepped up after two correct in a row.
					</p>
				</div>
				<div className="flex items-baseline gap-1 tabular-nums">
					<span className="text-2xl font-semibold text-card-foreground">{safeAfter}</span>
					<span className="text-xs font-semibold text-[var(--link)] dark:text-[var(--subject-grid-icon)]">
						+{delta}
					</span>
				</div>
			</div>
			<div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-border/40">
				<div className="relative h-full">
					<div
						className="absolute inset-y-0 left-0 rounded-full bg-[var(--subject-grid-icon)]/40"
						style={{ width: `${safeBefore}%` }}
					/>
					<div
						className="absolute inset-y-0 left-0 rounded-full bg-[var(--subject-grid-icon)]"
						style={{ width: `${safeAfter}%` }}
					/>
				</div>
			</div>
		</div>
	);
}

function OptionRow({ option, index }: { option: AnswerOption; index: number }) {
	return (
		<li
			className={cn(
				"flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-colors medium:px-4 medium:py-3",
				option.state === "correct" &&
					"border-[var(--mastery-strong)]/50 bg-[var(--mastery-strong)]/10 text-card-foreground",
				option.state === "incorrect" &&
					"border-[var(--mastery-critical)]/40 bg-[var(--mastery-critical)]/10 text-card-foreground line-through decoration-[var(--mastery-critical)]/60",
				option.state === "active" && "border-border/70 bg-card text-card-foreground",
			)}
		>
			<span className="inline-flex items-center gap-2.5">
				<span className="border-border bg-background flex size-6 shrink-0 items-center justify-center rounded-md border text-[11px] font-semibold text-muted-foreground">
					{String.fromCharCode(65 + index)}
				</span>
				<span>{option.label}</span>
			</span>
			{option.state === "correct" ? (
				<Check className="size-4 text-[var(--mastery-strong)]" aria-hidden />
			) : option.state === "incorrect" ? (
				<X className="size-4 text-[var(--mastery-critical)]" aria-hidden />
			) : null}
		</li>
	);
}

export function LandingPracticePreview() {
	return (
		<section
			id="adaptive-practice-proof"
			className="bg-background px-4 py-20 medium:px-6 medium:py-24 xl:px-8 xl:py-28"
			aria-labelledby="adaptive-practice-proof-title"
		>
			<div className="mx-auto w-full max-w-7xl">
				<div className="mx-auto mb-10 max-w-3xl text-center medium:mb-12">
					<Badge variant="outline" className={cn("mb-4", landingMarketingSectionEyebrowBadgeClassName)}>
						A live set
					</Badge>
					<h2
						id="adaptive-practice-proof-title"
						className="text-balance text-3xl font-semibold tracking-tight text-foreground medium:text-4xl"
					>
						What a 20 minute set looks like, mid-question.
					</h2>
					<p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground medium:text-lg">
						Three chapters, one in focus, difficulty shifting as the answers land. The same view your child sees in the app.
					</p>
				</div>

				<div
					className={cn(
						"relative overflow-hidden rounded-3xl",
						landingFeatureBentoShell,
						"p-5 medium:p-8 xl:p-10",
					)}
				>
					<div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4 medium:pb-6">
						<div className="flex items-center gap-3">
							<span className="border-border bg-[var(--subject-grid-icon)]/10 ring-[var(--subject-grid-icon)]/30 flex size-9 shrink-0 items-center justify-center rounded-xl border ring-1 text-[var(--subject-grid-icon)] font-semibold text-sm">
								9
							</span>
							<div>
								<p className="text-sm font-semibold text-card-foreground">Class 9 maths · 20 minute set</p>
								<p className="text-[12px] text-muted-foreground">3 weak chapters · CBSE</p>
							</div>
						</div>
						<div className="flex items-center gap-3 text-[12px] text-muted-foreground tabular-nums">
							<span>Question 7 of 12</span>
							<span aria-hidden>·</span>
							<span>14:32 left</span>
						</div>
					</div>

					<ul className="mt-5 flex flex-wrap gap-2 medium:mt-6">
						{FOCUS_CHAPTERS.map((chapter) => (
							<li
								key={chapter.chapter}
								className={cn(
									"inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-medium medium:text-[13px]",
									FOCUS_STATE_CLASSNAMES[chapter.state],
								)}
							>
								{chapter.state === "done" ? (
									<Check className="size-3" aria-hidden />
								) : chapter.state === "active" ? (
									<CircleDot className="size-3" aria-hidden />
								) : null}
								<span>{chapter.chapter}</span>
								<span
									className={cn(
										"inline-flex items-center rounded-full border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide",
										DIFFICULTY_CLASSNAMES[chapter.difficulty],
									)}
								>
									{DIFFICULTY_LABELS[chapter.difficulty]}
								</span>
							</li>
						))}
					</ul>

					<div className="mt-6 grid gap-5 medium:mt-8 xl:grid-cols-[1.35fr_1fr] xl:gap-8">
						<div className="border-border/60 rounded-2xl border bg-card/60 p-4 medium:p-6">
							<div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--link)] dark:text-[var(--subject-grid-icon)]">
								<span>{QUESTION.chapter}</span>
								<span aria-hidden className="size-1 rounded-full bg-current opacity-60" />
								<span className="text-muted-foreground">Hard</span>
							</div>
							<p className="mt-3 text-pretty text-[15px] leading-relaxed text-card-foreground medium:text-base">
								{QUESTION.prompt}
							</p>
							<ul className="mt-5 grid gap-2.5">
								{QUESTION.options.map((option, index) => (
									<OptionRow key={option.label} option={option} index={index} />
								))}
							</ul>
							<p className="mt-4 text-[12px] italic text-muted-foreground medium:text-[13px]">
								Hint when stuck: <span className="not-italic">{QUESTION.hint}</span>
							</p>
						</div>

						<div className="flex flex-col gap-4 medium:gap-5">
							<MasteryRibbon before={58} after={71} />
							<div className="border-border/60 rounded-2xl border bg-muted/30 p-4 text-sm medium:p-5">
								<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--link)] dark:text-[var(--subject-grid-icon)]">
									What this set is doing
								</p>
								<ol className="mt-3 grid gap-2.5">
									{[
										"Warmed up on Quadrilaterals (a chapter you already know)",
										"Now probing Triangles, the weakest of the three",
										"Will close with a recap so the radar updates tonight",
									].map((step, index) => (
										<li key={step} className="flex gap-3 text-[13px] text-card-foreground medium:text-sm">
											<span className="text-[var(--link)] dark:text-[var(--subject-grid-icon)] font-semibold tabular-nums">
												{index + 1}.
											</span>
											<span className="text-pretty">{step}</span>
										</li>
									))}
								</ol>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
