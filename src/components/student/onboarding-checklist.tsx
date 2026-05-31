"use client";

import Link from "next/link";
import { ArrowRightIcon, CheckIcon, CircleIcon, SparklesIcon, XIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	cardSurfaceFrameClassName,
} from "@/components/ui/card";
import type { StudentDashboardOnboarding } from "@/lib/student/load-student-dashboard";
import { cn } from "@/lib/utils";

/**
 * localStorage flag so a dismissed checklist stays dismissed across reloads. We
 * intentionally avoid a DB column (migration-free): completion is derived from
 * existing data and dismissal is a per-device UI preference.
 */
const DISMISS_STORAGE_KEY = "24vertex:onboarding-checklist-dismissed";

/**
 * Subscribers to the dismissal flag. `useSyncExternalStore` reads localStorage on
 * the client and a stable `false` on the server, so SSR renders the not-dismissed
 * state and the client reconciles after hydration — no `setState`-in-effect, no
 * hydration mismatch warning.
 */
const dismissListeners = new Set<() => void>();

function notifyDismissChange(): void {
	for (const listener of dismissListeners) {
		listener();
	}
}

function subscribeDismissed(onStoreChange: () => void): () => void {
	dismissListeners.add(onStoreChange);
	if (typeof window !== "undefined") {
		// Keep multiple tabs (and other instances on the page) in sync.
		window.addEventListener("storage", onStoreChange);
	}
	return () => {
		dismissListeners.delete(onStoreChange);
		if (typeof window !== "undefined") {
			window.removeEventListener("storage", onStoreChange);
		}
	};
}

function getDismissedSnapshot(): boolean {
	if (typeof window === "undefined") return false;
	try {
		return window.localStorage.getItem(DISMISS_STORAGE_KEY) === "1";
	} catch {
		// Private mode / storage disabled: treat as not dismissed.
		return false;
	}
}

function getDismissedServerSnapshot(): boolean {
	return false;
}

function dismissChecklist(): void {
	if (typeof window !== "undefined") {
		try {
			window.localStorage.setItem(DISMISS_STORAGE_KEY, "1");
		} catch {
			// Ignore write failures (private mode); the in-memory notify still hides it.
		}
	}
	notifyDismissChange();
}

type ChecklistItem = {
	id: string;
	label: string;
	description: string;
	href: string;
	cta: string;
	done: boolean;
};

export type OnboardingChecklistProps = {
	onboarding: StudentDashboardOnboarding;
};

export function OnboardingChecklist({ onboarding }: OnboardingChecklistProps) {
	const dismissed = useSyncExternalStore(
		subscribeDismissed,
		getDismissedSnapshot,
		getDismissedServerSnapshot,
	);

	const items: ChecklistItem[] = [
		{
			id: "test",
			label: "Take your first test",
			description: "Generate a practice test tuned to your grade and subjects.",
			href: "/student/practice",
			cta: "Start practice",
			done: onboarding.hasTakenTest,
		},
		{
			id: "doubt",
			label: "Ask your first doubt",
			description: "Get step-by-step help from the AI tutor on any topic.",
			href: "/student/doubt-chat",
			cta: "Open doubt chat",
			done: onboarding.hasAskedDoubt,
		},
		{
			id: "parent",
			label: "Link a parent",
			description: "Share your progress with a parent or guardian.",
			href: "/student/settings",
			cta: "Go to settings",
			done: onboarding.hasLinkedParent,
		},
	];

	const completedCount = items.filter((item) => item.done).length;
	const allComplete = completedCount === items.length;
	const progressPct = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

	// Auto-hide when the account is no longer new, every step is done, or the
	// student dismissed it. Gating here (not via early-mount effects) keeps SSR
	// output deterministic.
	if (!onboarding.isNewStudent || allComplete || dismissed) {
		return null;
	}

	return (
		<Card
			className={cn(
				cardSurfaceFrameClassName,
				"w-full min-w-0 gap-0 py-0 shadow-none",
				"motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-300 motion-reduce:animate-none",
			)}
		>
			<CardHeader className="flex flex-row items-start justify-between gap-3 px-5 pb-3 pt-5">
				<div className="flex min-w-0 flex-col gap-1">
					<CardTitle className="flex items-center gap-2.5 text-base font-semibold leading-snug">
						<SparklesIcon
							className="size-5 shrink-0 text-violet-600 dark:text-violet-400"
							strokeWidth={2}
							aria-hidden
						/>
						Get started
					</CardTitle>
					<CardDescription className="text-sm leading-snug tabular-nums">
						{completedCount} of {items.length} done · finish setting up your account
					</CardDescription>
					<div
						className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
						role="progressbar"
						aria-valuemin={0}
						aria-valuemax={items.length}
						aria-valuenow={completedCount}
						aria-label={`Onboarding progress: ${completedCount} of ${items.length} done`}
					>
						<div
							className="h-full rounded-full bg-emerald-600 transition-[width] duration-500 ease-out motion-reduce:transition-none dark:bg-emerald-500"
							style={{ width: `${progressPct}%` }}
						/>
					</div>
				</div>
				<Button
					variant="ghost"
					size="icon-sm"
					className="shrink-0 text-muted-foreground"
					aria-label="Hide get started checklist"
					onClick={() => {
						dismissChecklist();
						toast.success("Checklist hidden. You can still use these features anytime.");
					}}
				>
					<XIcon aria-hidden />
				</Button>
			</CardHeader>
			<CardContent className="px-5 pb-5 pt-0">
				<ul className="flex flex-col gap-2.5">
					{items.map((item) => (
						<li key={item.id}>
							<div
								className={cn(
									"flex items-center gap-3 rounded-lg px-4 py-3 transition-colors",
									item.done ? "bg-muted/20" : "bg-muted/25",
								)}
							>
								<span
									className={cn(
										"flex size-7 shrink-0 items-center justify-center rounded-full border",
										item.done
											? "border-emerald-600/30 bg-emerald-600/10 text-emerald-600 dark:border-emerald-400/30 dark:text-emerald-400"
											: "border-border bg-background text-muted-foreground/60",
									)}
									aria-hidden
								>
									{item.done ? (
										<CheckIcon className="size-4" strokeWidth={2.5} />
									) : (
										<CircleIcon className="size-3.5" strokeWidth={2} />
									)}
								</span>
								<div className="flex min-w-0 flex-1 flex-col">
									<p
										className={cn(
											"truncate text-sm font-semibold",
											item.done && "text-muted-foreground line-through",
										)}
									>
										{item.label}
									</p>
									<p className="mt-0.5 text-xs leading-snug text-muted-foreground">
										{item.description}
									</p>
								</div>
								{item.done ? (
									<span className="shrink-0 text-xs font-medium text-emerald-600 dark:text-emerald-400">
										Done
									</span>
								) : (
									<Button
										variant="outline"
										size="sm"
										className="shrink-0"
										render={<Link href={item.href} />}
									>
										{item.cta}
										<ArrowRightIcon aria-hidden />
									</Button>
								)}
							</div>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
