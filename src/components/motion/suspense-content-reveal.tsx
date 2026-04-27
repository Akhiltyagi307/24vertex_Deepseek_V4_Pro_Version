"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type SuspenseContentRevealProps = {
	children: ReactNode;
	className?: string;
};

/**
 * Soft fade-in when streamed / async content replaces a Suspense fallback.
 * Use on routes without heavy inner motion to avoid stacking many fades.
 */
export function SuspenseContentReveal({ children, className }: SuspenseContentRevealProps) {
	const reduceMotion = useReducedMotion();
	const duration = reduceMotion ? 0 : 0.18;

	return (
		<motion.div
			className={cn("min-h-0 min-w-0 w-full", className)}
			initial={reduceMotion ? false : { opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={{ duration, ease: "easeOut" }}
		>
			{children}
		</motion.div>
	);
}
