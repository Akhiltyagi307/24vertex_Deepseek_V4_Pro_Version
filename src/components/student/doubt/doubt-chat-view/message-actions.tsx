"use client";

import { useState } from "react";
import { Check, Copy, Loader2, RefreshCw } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function MessageActions({
	text,
	canRegenerate,
	regenPending,
	onRegenerate,
}: {
	text: string;
	canRegenerate?: boolean;
	regenPending?: boolean;
	onRegenerate?: () => void;
}) {
	const [copied, setCopied] = useState(false);

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
