"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type SegmentPageTransitionProps = {
	children: ReactNode;
	className?: string;
};

/**
 * Enter animation for App Router `template.tsx` segments: remounts on in-segment
 * navigation so each route gets a short fade / lift (skipped when reduced motion).
 */
export function SegmentPageTransition({ children, className }: SegmentPageTransitionProps) {
	const reduceMotion = useReducedMotion();
	const y = reduceMotion ? 0 : 6;
	const duration = reduceMotion ? 0 : 0.22;

	return (
		<motion.div
			className={cn("min-h-0 min-w-0 w-full max-w-none", className)}
			initial={reduceMotion ? false : { opacity: 0, y }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration, ease: [0.25, 0.1, 0.25, 1] }}
		>
			{children}
		</motion.div>
	);
}
