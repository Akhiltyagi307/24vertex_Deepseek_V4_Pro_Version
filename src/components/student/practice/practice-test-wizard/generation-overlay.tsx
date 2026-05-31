"use client";

import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GridLoader } from "@/components/ui/grid-loader";
import { GENERATION_BUCKETS } from "@/lib/practice/generation-progress-buckets";
import { cn } from "@/lib/utils";

import { practiceSolidCtaClassName } from "./types";

/** 1-based index of the "Writing questions" bucket — where the drafted count shows. */
const WRITING_BUCKET_INDEX = 3;

export type GenerationOverlayProps = {
	generating: boolean;
	/** Highest completed checklist bucket (1-based); 0 = nothing done yet. */
	doneThrough: number;
	/** Questions drafted so far (during the writing step), or null if unknown. */
	draftedCount: number | null;
	/** Expected total questions from the duration plan, or null if unknown. */
	draftedTotal: number | null;
	generatedPreview: { testId: string; subjectName: string } | null;
	pending: boolean;
	onCancelGenerate: () => void;
	onStartTest: () => void;
	onBack: () => void;
};

export function GenerationOverlay({
	generating,
	doneThrough,
	draftedCount,
	draftedTotal,
	generatedPreview,
	pending,
	onCancelGenerate,
	onStartTest,
	onBack,
}: GenerationOverlayProps) {
	if (!generating && !generatedPreview) return null;
	return (
		<div
			className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-background/85 px-6 backdrop-blur-sm"
			aria-busy={generating}
		>
			{generating ? (
				<>
					<GridLoader size="md" />
					<ol className="w-full max-w-xs space-y-2.5" aria-label="Generating your test">
						{GENERATION_BUCKETS.map((bucket, i) => {
							const index = i + 1;
							const status =
								index <= doneThrough ? "done"
								: index === doneThrough + 1 ? "active"
								: "pending";
							const showDrafted =
								status === "active" && index === WRITING_BUCKET_INDEX && draftedCount !== null;
							return (
								<li key={bucket.id} className="flex items-start gap-2.5">
									<span
										className={cn(
											"mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
											status === "done" ?
												"border-emerald-600/40 bg-emerald-600/10 text-emerald-600 dark:text-emerald-400"
											: status === "active" ?
												"border-primary/50 bg-primary/10 text-primary"
											:	"border-border bg-muted/40",
										)}
										aria-hidden
									>
										{status === "done" ?
											<CheckIcon className="size-3" strokeWidth={2.5} />
										: status === "active" ?
											<span className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse" />
										:	<span className="size-1.5 rounded-full bg-muted-foreground/40" />}
									</span>
									<span className="flex flex-col gap-0.5">
										<span
											className={cn(
												"text-sm leading-snug",
												status === "pending" ? "text-muted-foreground/60" : "text-foreground",
											)}
										>
											{bucket.label}
										</span>
										{showDrafted ? (
											<span className="text-muted-foreground text-xs tabular-nums">
												{draftedTotal ?
													`Drafted ${Math.min(draftedCount, draftedTotal)} of ${draftedTotal} questions`
												:	`Drafted ${draftedCount} questions`}
											</span>
										) : null}
									</span>
								</li>
							);
						})}
					</ol>
					<p className="text-muted-foreground px-4 text-center text-sm">This usually takes a minute or two.</p>
					<Button type="button" variant="outline" size="sm" onClick={onCancelGenerate} className="mt-1">
						<XIcon className="mr-1.5 size-4" aria-hidden />
						Cancel
					</Button>
				</>
			) : generatedPreview ? (
				<Card
					role="dialog"
					aria-modal="true"
					aria-labelledby="practice-ready-title"
					className="border-border/80 w-full max-w-md shadow-lg"
				>
					<CardHeader className="gap-3 text-center medium:text-left">
						<div
							className="mx-auto flex size-14 items-center justify-center rounded-full border border-emerald-600/35 bg-emerald-600/10 medium:mx-0"
							aria-hidden
						>
							<CheckIcon className="size-7 text-emerald-600 dark:text-emerald-400" strokeWidth={2} />
						</div>
						<CardTitle id="practice-ready-title" className="text-xl">
							Your test is ready
						</CardTitle>
						<CardDescription className="text-base leading-relaxed">
							The timer starts when you begin—get comfortable, then start when you&apos;re ready to focus.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-3 pt-0">
						<Button
							type="button"
							className={cn("h-11 w-full text-base", practiceSolidCtaClassName)}
							onClick={onStartTest}
							disabled={pending}
						>
							Start test
						</Button>
						<Button
							type="button"
							variant="ghost"
							className="text-muted-foreground h-11 w-full"
							onClick={onBack}
							disabled={pending}
						>
							<ChevronDownIcon className="mr-1.5 size-4 rotate-90" aria-hidden strokeWidth={2} />
							Back
						</Button>
					</CardContent>
				</Card>
			) : null}
		</div>
	);
}
