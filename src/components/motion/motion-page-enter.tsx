"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type MotionPageEnterProps = {
	children: ReactNode;
	className?: string;
};

/**
 * Full-column enter for routes without a segment `template.tsx` (e.g. marketing, legal).
 * Uses opacity + slight vertical motion; skipped when reduced motion is preferred.
 */
export function MotionPageEnter({ children, className }: MotionPageEnterProps) {
	const reduceMotion = useReducedMotion();
	const y = reduceMotion ? 0 : 8;
	const duration = reduceMotion ? 0 : 0.24;

	return (
		<motion.div
			className={cn("min-w-0 w-full", className)}
			initial={reduceMotion ? false : { opacity: 0, y }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration, ease: [0.25, 0.1, 0.25, 1] }}
		>
			{children}
		</motion.div>
	);
}
