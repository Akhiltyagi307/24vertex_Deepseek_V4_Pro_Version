import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const pageHeaderSubtextScrollClass = "min-w-0 max-w-full overflow-x-auto";

export const pageHeaderSubtextTextClass =
	"text-muted-foreground text-base leading-relaxed whitespace-nowrap";

type PageHeaderSubtextProps = {
	children: ReactNode;
	className?: string;
};

/** One sentence under the page title: dashboard type scale, single line (scrolls on narrow viewports). */
export function PageHeaderSubtext({ children, className }: PageHeaderSubtextProps) {
	return (
		<div className={cn(pageHeaderSubtextScrollClass, className)}>
			<p className={pageHeaderSubtextTextClass}>{children}</p>
		</div>
	);
}
