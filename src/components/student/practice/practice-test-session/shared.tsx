import * as React from "react";

import { normalizeDifficultyLevel } from "@/lib/practice/practice-session-utils";
import { cn } from "@/lib/utils";

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
	return (
		<kbd
			className={cn(
				"inline-flex min-h-7 min-w-7 items-center justify-center rounded-md px-1.5",
				"border border-b-2 border-foreground/18 bg-muted font-mono text-[11px] font-semibold tabular-nums",
				"text-foreground shadow-[0_1px_0_rgba(0,0,0,0.06)] dark:border-border dark:bg-muted/90 dark:shadow-[0_1px_0_rgba(255,255,255,0.04)]",
				className,
			)}
		>
			{children}
		</kbd>
	);
}

export function difficultyClass(d: string | null): string {
	const n = normalizeDifficultyLevel(d);
	if (n === "hard") {
		return "border-red-800/55 bg-red-950/60 text-red-100 dark:border-red-700/55 dark:bg-red-950/65 dark:text-red-50";
	}
	if (n === "medium") {
		return "border-amber-600/50 bg-amber-950/45 text-amber-100 dark:border-amber-500/45 dark:bg-amber-950/50 dark:text-amber-50";
	}
	if (n === "easy") {
		return "border-emerald-700/45 bg-emerald-950/45 text-emerald-100 dark:border-emerald-600/45 dark:bg-emerald-950/50 dark:text-emerald-50";
	}
	return "border-border/55 bg-muted/35 text-foreground/70 dark:text-foreground/65";
}

export function isTypingTarget(target: EventTarget | null): boolean {
	if (!target || !(target instanceof HTMLElement)) return false;
	if (target.isContentEditable) return true;
	if (target.closest("[data-practice-answer-field='true']")) return true;
	if (target instanceof HTMLTextAreaElement) return true;
	if (target instanceof HTMLInputElement) {
		const t = target.type;
		return t === "text" || t === "number" || t === "search" || t === "email" || t === "password";
	}
	return false;
}

export const confirmSubmitCta =
	"!bg-emerald-600 hover:!bg-emerald-600/90 dark:!bg-emerald-500 dark:hover:!bg-emerald-500/90";
