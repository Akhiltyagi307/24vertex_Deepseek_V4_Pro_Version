"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, GraduationCap, Loader2, RefreshCw, Sparkle } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Builds the practice-wizard deep link for a doubt's scope. The wizard reads
 * `subjectId` + `topicIds` from the URL and auto-selects those topics, so this
 * closes the learning loop: "I understood the explanation → drill it now."
 */
function buildPracticeTopicHref(subjectId: string, topicId: string): string {
	const params = new URLSearchParams();
	params.set("subjectId", subjectId);
	params.set("topicIds", topicId);
	return `/student/practice?${params.toString()}`;
}

export function MessageActions({
	text,
	canRegenerate,
	regenPending,
	onRegenerate,
	canRequestSimilar,
	onRequestSimilar,
	subjectId,
	topicId,
}: {
	text: string;
	canRegenerate?: boolean;
	regenPending?: boolean;
	onRegenerate?: () => void;
	/**
	 * True when the surrounding mode + thread state make a "give me a similar
	 * problem" follow-up meaningful — i.e. Solve-with-me mode and the last
	 * assistant turn appears to contain a solved problem. The chip simply
	 * dispatches a templated user message; no separate endpoint.
	 */
	canRequestSimilar?: boolean;
	onRequestSimilar?: () => void;
	/** Doubt scope — drives the "Practice this topic" deep link into the wizard. */
	subjectId?: string;
	/** Present only when a single topic is in scope; gates the practice CTA. */
	topicId?: string | null;
}) {
	const [copied, setCopied] = useState(false);
	const practiceHref =
		subjectId && topicId ? buildPracticeTopicHref(subjectId, topicId) : null;

	async function onCopy() {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1400);
		} catch {
			// ignore — clipboard may be unavailable (e.g. insecure context)
		}
	}

	return (
		<div
			className={cn(
				"mt-1.5 flex items-center gap-1 transition-opacity duration-150",
				"opacity-0 focus-within:opacity-100 group-hover/msg:opacity-100",
				"motion-reduce:opacity-100 motion-reduce:transition-none",
			)}
		>
			<Tooltip>
				<TooltipTrigger
					render={
						<button
							type="button"
							onClick={() => void onCopy()}
							aria-label={copied ? "Copied" : "Copy message"}
							className={cn(
								"text-muted-foreground hover:text-foreground hover:bg-muted/70 inline-flex size-7 items-center justify-center rounded-md",
								"focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none",
							)}
						/>
					}
				>
					{copied ? (
						<Check className="size-3.5" aria-hidden />
					) : (
						<Copy className="size-3.5" aria-hidden />
					)}
				</TooltipTrigger>
				<TooltipContent>{copied ? "Copied" : "Copy"}</TooltipContent>
			</Tooltip>
			{canRegenerate ? (
				<Tooltip>
					<TooltipTrigger
						render={
							<button
								type="button"
								onClick={() => onRegenerate?.()}
								disabled={regenPending}
								aria-label={regenPending ? "Regenerating" : "Regenerate this answer"}
								className={cn(
									"text-muted-foreground hover:text-foreground hover:bg-muted/70 inline-flex size-7 items-center justify-center rounded-md",
									"focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none",
									"disabled:opacity-50 disabled:cursor-not-allowed",
								)}
							/>
						}
					>
						{regenPending ? (
							<Loader2 className="size-3.5 animate-spin" aria-hidden />
						) : (
							<RefreshCw className="size-3.5" aria-hidden />
						)}
					</TooltipTrigger>
					<TooltipContent>{regenPending ? "Regenerating" : "Regenerate"}</TooltipContent>
				</Tooltip>
			) : null}
			{canRequestSimilar ? (
				<Tooltip>
					<TooltipTrigger
						render={
							<button
								type="button"
								onClick={() => onRequestSimilar?.()}
								aria-label="Give me a similar problem"
								className={cn(
									"text-muted-foreground hover:text-foreground hover:bg-muted/70 inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px]",
									"focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none",
								)}
							/>
						}
					>
						<Sparkle className="size-3.5" aria-hidden />
						<span>Similar one</span>
					</TooltipTrigger>
					<TooltipContent>Ask for a similar problem with different numbers</TooltipContent>
				</Tooltip>
			) : null}
			{practiceHref ? (
				<Tooltip>
					<TooltipTrigger
						render={
							<Link
								href={practiceHref}
								aria-label="Practice this topic"
								className={cn(
									"text-muted-foreground hover:text-foreground hover:bg-muted/70 inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px]",
									"focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none",
								)}
							/>
						}
					>
						<GraduationCap className="size-3.5" aria-hidden />
						<span>Practice this topic</span>
					</TooltipTrigger>
					<TooltipContent>Generate a practice test on this topic</TooltipContent>
				</Tooltip>
			) : null}
		</div>
	);
}

export function TypingIndicator() {
	return (
		<span
			className="text-muted-foreground inline-flex items-center gap-1 motion-reduce:hidden"
			aria-label="Tutor is thinking"
			role="status"
		>
			<span className="bg-muted-foreground/70 inline-block size-1.5 animate-pulse rounded-full [animation-delay:-240ms]" />
			<span className="bg-muted-foreground/70 inline-block size-1.5 animate-pulse rounded-full [animation-delay:-120ms]" />
			<span className="bg-muted-foreground/70 inline-block size-1.5 animate-pulse rounded-full" />
		</span>
	);
}
