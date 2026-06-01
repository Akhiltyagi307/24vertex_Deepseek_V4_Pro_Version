"use client";

import Link from "next/link";
import { ArrowRightIcon, SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

export type WelcomeDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	/** Short confirmation/intro lines rendered as a stacked paragraph list. */
	lines: string[];
	/** Primary play-first action; navigates via Next.js Link. */
	primaryCta?: { label: string; href: string };
	/** When provided, renders a "Take a quick tour" action that starts coach-marks. */
	onStartTour?: () => void;
};

/**
 * Role-agnostic first-run welcome modal. Reused by student/teacher/parent flows:
 * the caller supplies copy, the primary CTA, and an optional tour starter. The
 * Dialog primitive owns Esc/backdrop/focus behavior; motion is gated by the
 * primitive's `data-open` animation utilities (no-op under reduced motion).
 */
export function WelcomeDialog({
	open,
	onOpenChange,
	title,
	lines,
	primaryCta,
	onStartTour,
}: WelcomeDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="medium:max-w-md">
				<DialogHeader>
					<span
						className="flex size-10 items-center justify-center rounded-lg border border-violet-600/30 bg-violet-600/10 text-violet-600 dark:border-violet-400/30 dark:text-violet-400"
						aria-hidden
					>
						<SparklesIcon className="size-5" strokeWidth={2} />
					</span>
					<DialogTitle className="text-lg leading-snug">{title}</DialogTitle>
					{lines.length > 0 ? (
						<DialogDescription className="flex flex-col gap-1.5 leading-snug">
							{lines.map((line, i) => (
								<span key={i}>{line}</span>
							))}
						</DialogDescription>
					) : null}
				</DialogHeader>
				<div className="flex flex-col gap-2.5">
					{primaryCta ? (
						<Button
							className="w-full"
							render={<Link href={primaryCta.href} />}
							onClick={() => onOpenChange(false)}
						>
							{primaryCta.label}
							<ArrowRightIcon aria-hidden />
						</Button>
					) : null}
					{onStartTour ? (
						<Button
							variant="outline"
							className="w-full"
							onClick={() => {
								onOpenChange(false);
								onStartTour();
							}}
						>
							<SparklesIcon aria-hidden />
							Take a quick tour
						</Button>
					) : null}
				</div>
			</DialogContent>
		</Dialog>
	);
}
