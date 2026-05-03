import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type SegmentPageTransitionProps = {
	children: ReactNode;
	className?: string;
};

/**
 * CSS-only enter animation for App Router `template.tsx` segments. Remounts on
 * in-segment navigation so each route gets a short fade / lift; reduced-motion
 * is honored in globals.css.
 */
export function SegmentPageTransition({ children, className }: SegmentPageTransitionProps) {
	return (
		<div className={cn("segment-enter min-h-0 min-w-0 w-full max-w-none", className)}>
			{children}
		</div>
	);
}
