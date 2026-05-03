import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type MotionPageEnterProps = {
	children: ReactNode;
	className?: string;
};

/**
 * CSS-only enter for routes without a segment `template.tsx` (marketing, legal).
 * Animation lives in globals.css `.motion-page-enter`; reduced-motion is honored there.
 */
export function MotionPageEnter({ children, className }: MotionPageEnterProps) {
	return <div className={cn("motion-page-enter min-w-0 w-full", className)}>{children}</div>;
}
