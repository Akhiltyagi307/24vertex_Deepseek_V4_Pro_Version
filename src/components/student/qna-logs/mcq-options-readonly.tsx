"use client";

import { CheckIcon, CircleDotIcon, XIcon } from "lucide-react";

import { LatexText } from "@/components/student/practice/latex-text";
import { optionEntries } from "@/lib/practice/practice-session-utils";
import { cn } from "@/lib/utils";

type Props = {
	options: Record<string, string> | null;
	selectedKey: string | null;
	correctKey: string | null;
	testStatus: "submitted" | "graded";
};

type RowVisual = {
	surface: string;
	chip: { label: string; tone: "correct" | "yourPick" | "wrongPick" } | null;
};

function rowVisual(
	letter: string,
	selectedKey: string | null,
	correctKey: string | null,
	testStatus: "submitted" | "graded",
): RowVisual {
	const isCorrect = correctKey != null && letter === correctKey;
	const isChosen = selectedKey != null && letter === selectedKey;

	if (testStatus !== "graded") {
		if (isChosen) {
			return {
				surface: "border-foreground/30 bg-muted/30",
				chip: { label: "Your pick", tone: "yourPick" },
			};
		}
		return { surface: "border-border/70 bg-muted/10", chip: null };
	}

	if (isCorrect && isChosen) {
		return {
			surface: "border-emerald-500/40 bg-emerald-500/10",
			chip: { label: "Your pick, correct", tone: "correct" },
		};
	}

	if (isCorrect) {
		return {
			surface: "border-emerald-500/40 bg-emerald-500/10",
			chip: { label: "Correct answer", tone: "correct" },
		};
	}

	if (isChosen) {
		return {
			surface: "border-rose-500/40 bg-rose-500/10",
			chip: { label: "Your pick", tone: "wrongPick" },
		};
	}

	return { surface: "border-border/70 bg-muted/10", chip: null };
}

function ChipLabel({ tone, label }: { tone: "correct" | "yourPick" | "wrongPick"; label: string }) {
	const Icon = tone === "correct" ? CheckIcon : tone === "wrongPick" ? XIcon : CircleDotIcon;
	const className =
		tone === "correct" ? "text-emerald-700 dark:text-emerald-200"
		: tone === "wrongPick" ? "text-rose-700 dark:text-rose-200"
		: "text-muted-foreground";
	return (
		<span className={cn("inline-flex items-center gap-1 text-xs font-medium tabular-nums", className)}>
			<Icon className="size-3.5" aria-hidden="true" />
			{label}
		</span>
	);
}

export function McqOptionsReadonly({ options, selectedKey, correctKey, testStatus }: Props) {
	if (!options) return null;
	const entries = optionEntries(options);
	if (entries.length === 0) return null;

	return (
		<section className="space-y-3">
			<h3 className="text-xs font-medium uppercase tracking-[0.04em] text-muted-foreground">
				Options
			</h3>
			<ul className="space-y-2">
				{entries.map(([letter, text]) => {
					const visual = rowVisual(letter, selectedKey, correctKey, testStatus);
					return (
						<li
							key={letter}
							className={cn(
								"flex items-start gap-3 rounded-md border p-3 transition-colors",
								visual.surface,
							)}
						>
							<span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-border bg-background text-xs font-semibold text-foreground/80">
								{letter}
							</span>
							<span className="flex-1 text-sm leading-relaxed text-foreground">
								<LatexText text={text} />
							</span>
							{visual.chip ? (
								<span className="mt-0.5 shrink-0">
									<ChipLabel tone={visual.chip.tone} label={visual.chip.label} />
								</span>
							) : null}
						</li>
					);
				})}
			</ul>
		</section>
	);
}
