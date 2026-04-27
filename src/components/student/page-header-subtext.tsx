import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const pageHeaderSubtextScrollClass = "min-w-0 max-w-full overflow-x-auto";

export const pageHeaderSubtextTextClass =
	"text-muted-foreground text-base leading-relaxed whitespace-nowrap";

/** Fills the title column width, wraps, no horizontal scroll (use inside max-width containers). */
export const pageHeaderSubtextWrapContainerClass = "min-w-0 w-full max-w-full";

export const pageHeaderSubtextWrapTextClass =
	"text-muted-foreground text-base leading-relaxed whitespace-normal break-words text-pretty";

type PageHeaderSubtextProps = {
	children: ReactNode;
	className?: string;
	/**
	 * `scroll` — single line with horizontal scroll on narrow viewports (default).
	 * `wrap` — wraps within the container; use where horizontal page scroll must be avoided.
	 */
	variant?: "scroll" | "wrap";
};

/** One sentence under the page title: dashboard type scale; default is single-line with optional scroll. */
export function PageHeaderSubtext({
	children,
	className,
	variant = "scroll",
}: PageHeaderSubtextProps) {
	const isWrap = variant === "wrap";
	return (
		<div
			className={cn(
				isWrap ? pageHeaderSubtextWrapContainerClass : pageHeaderSubtextScrollClass,
				className,
			)}
		>
			<p className={isWrap ? pageHeaderSubtextWrapTextClass : pageHeaderSubtextTextClass}>
				{children}
			</p>
		</div>
	);
}
