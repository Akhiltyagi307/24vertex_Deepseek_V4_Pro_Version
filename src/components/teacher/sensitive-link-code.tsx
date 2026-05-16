"use client";

import { Check, Copy, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MASKED_LINK_CODE = "••••••";

export function SensitiveLinkCode({
	code,
	className,
}: {
	code: string | null | undefined;
	className?: string;
}) {
	const normalized = code?.trim() || null;
	const [revealed, setRevealed] = useState(false);
	const [copied, setCopied] = useState(false);

	if (!normalized) {
		return <span className={cn("font-mono text-muted-foreground text-xs tabular-nums", className)}>—</span>;
	}

	const display = revealed ? normalized : MASKED_LINK_CODE;

	const handleCopy = async () => {
		try {
			await navigator.clipboard?.writeText(normalized);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1600);
		} catch {
			setCopied(false);
		}
	};

	return (
		<span className={cn("inline-flex items-center gap-1.5", className)}>
			<span className="font-mono text-muted-foreground text-xs tabular-nums" aria-live="polite">
				{display}
			</span>
			<Button
				type="button"
				variant="ghost"
				size="icon-xs"
				className="text-muted-foreground hover:text-foreground"
				aria-label={revealed ? "Hide student link code" : "Show student link code"}
				onClick={() => setRevealed((next) => !next)}
			>
				{revealed ? <EyeOff aria-hidden className="size-3" /> : <Eye aria-hidden className="size-3" />}
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon-xs"
				className="text-muted-foreground hover:text-foreground"
				aria-label="Copy student link code"
				onClick={() => void handleCopy()}
			>
				{copied ? <Check aria-hidden className="size-3" /> : <Copy aria-hidden className="size-3" />}
			</Button>
			<span className="sr-only" aria-live="polite">
				{copied ? "Copied student link code." : ""}
			</span>
		</span>
	);
}

