"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { cardSurfaceFrameClassName } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
	fetchCachedClassInsightAction,
	generateTeacherClassInsightAction,
} from "./teacher-dashboard-actions";
import type { TeacherClassInsight } from "@/lib/teachers/teacher-class-insight";
import type { ClassInsightLookupOutcome } from "@/lib/teachers/teacher-class-insight-service";

type Props = {
	grade: number | "all";
	section: string | "all";
	subjectId: string | "all";
	scopeLabel: string;
	/** SSR-resolved cache probe for the initial scope; null for filtered scopes (probed client-side on mount). */
	initialLookup: ClassInsightLookupOutcome | null;
};

type InsightSource = "cache" | "fresh";

type CardState =
	| { kind: "checking" }
	| { kind: "idle" }
	| { kind: "loading" }
	| { kind: "insight"; insight: TeacherClassInsight; source: InsightSource }
	| { kind: "insufficient_data" }
	| { kind: "error"; message: string };

function stateFromLookup(lookup: ClassInsightLookupOutcome | null): CardState {
	if (!lookup) return { kind: "checking" };
	if (lookup.status === "ok") {
		return { kind: "insight", insight: lookup.insight, source: lookup.source };
	}
	if (lookup.status === "insufficient_data") return { kind: "insufficient_data" };
	return { kind: "idle" };
}

export function TeacherDashboardInsightCard({
	grade,
	section,
	subjectId,
	scopeLabel,
	initialLookup,
}: Props) {
	const [state, setState] = useState<CardState>(() => stateFromLookup(initialLookup));

	// Filtered scopes have no SSR-resolved lookup — probe the cache once on mount
	// (free, no model call). The card is keyed by scope, so mount === scope.
	useEffect(() => {
		if (initialLookup) return;
		let cancelled = false;
		void (async () => {
			try {
				const res = await fetchCachedClassInsightAction({ grade, section, subjectId, scopeLabel });
				if (cancelled) return;
				setState("error" in res ? { kind: "idle" } : stateFromLookup(res));
			} catch {
				if (cancelled) return;
				setState({ kind: "idle" });
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [grade, section, subjectId, scopeLabel, initialLookup]);

	const runGenerate = async (force: boolean) => {
		setState({ kind: "loading" });
		try {
			const res = await generateTeacherClassInsightAction({
				grade,
				section,
				subjectId,
				scopeLabel,
				force,
			});
			if ("error" in res) {
				setState({ kind: "error", message: res.error });
				return;
			}
			if (res.status === "insufficient_data") {
				setState({ kind: "insufficient_data" });
				return;
			}
			setState({ kind: "insight", insight: res.insight, source: res.source });
		} catch {
			setState({ kind: "error", message: "Could not generate insight. Try again." });
		}
	};

	return (
		<div
			className={cn(cardSurfaceFrameClassName, "flex w-full flex-col gap-4 p-6 text-left")}
			aria-live="polite"
		>
			<div className="flex w-full items-start justify-between gap-3">
				<div className="flex min-w-0 items-center gap-2.5">
					<span
						className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary dark:bg-primary/16"
						aria-hidden
					>
						<Sparkles className="size-4" />
					</span>
					<div className="min-w-0">
						<p className="text-sm font-medium text-foreground">AI class insight</p>
						<p className="truncate text-muted-foreground text-xs">{scopeLabel}</p>
					</div>
				</div>
				{state.kind === "insight" ? (
					<Button
						type="button"
						variant="outline"
						onClick={() => void runGenerate(true)}
						className="h-8 shrink-0 px-3 text-xs"
					>
						Regenerate
					</Button>
				) : null}
			</div>

			{state.kind === "checking" ? (
				<div className="flex items-center gap-2 text-muted-foreground text-sm" role="status">
					<Loader2 className="size-4 animate-spin" aria-hidden />
					Checking for a saved insight…
				</div>
			) : null}

			{state.kind === "idle" ? (
				<div className="flex flex-col items-start gap-3">
					<p className="text-muted-foreground text-sm leading-normal">
						Turn this scope&apos;s averages and weak topics into a short, actionable briefing.
					</p>
					<Button type="button" onClick={() => void runGenerate(false)} className="gap-2">
						<Sparkles className="size-4" aria-hidden />
						Generate insight
					</Button>
				</div>
			) : null}

			{state.kind === "loading" ? (
				<div className="flex items-center gap-2 text-muted-foreground text-sm" role="status">
					<Loader2 className="size-4 animate-spin" aria-hidden />
					Analysing class performance…
				</div>
			) : null}

			{state.kind === "insight" ? (
				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-1.5">
						<p className="font-medium text-foreground text-sm leading-snug">{state.insight.headline}</p>
						<p className="text-muted-foreground text-sm leading-normal">{state.insight.narrative}</p>
					</div>
					<ul className="flex flex-col gap-2" role="list">
						{state.insight.actions.map((action, index) => (
							<li
								key={index}
								className="rounded-lg border border-border/60 bg-muted/15 px-3 py-2.5 dark:bg-muted/10"
							>
								<p className="font-medium text-foreground text-sm">{action.title}</p>
								<p className="mt-0.5 text-muted-foreground text-xs leading-normal">{action.detail}</p>
							</li>
						))}
					</ul>
					<p className="text-muted-foreground text-[0.6875rem]">
						{state.source === "cache"
							? "Saved insight · regenerate for the latest."
							: "AI-generated from your class data. Review before acting."}
					</p>
				</div>
			) : null}

			{state.kind === "insufficient_data" ? (
				<p className="text-muted-foreground text-sm leading-normal">
					Not enough graded work in this scope yet. Insights need at least one student with a recent graded
					assignment or practice test.
				</p>
			) : null}

			{state.kind === "error" ? (
				<div className="flex flex-col items-start gap-3">
					<p className="text-destructive text-sm" role="alert">
						{state.message}
					</p>
					<Button type="button" variant="outline" onClick={() => void runGenerate(false)}>
						Try again
					</Button>
				</div>
			) : null}
		</div>
	);
}
