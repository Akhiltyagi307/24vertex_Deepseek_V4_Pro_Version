"use client";

/**
 * 3×3 grid pulse loader — same behavior as @smoothui/grid-loader (SmoothUI registry).
 * Inlined here when the shadcn registry CLI cannot reach the network.
 */
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

/** Default pattern: hollow plus (SmoothUI `plus-hollow`). */
const PATTERN: readonly (0 | 1)[] = [0, 1, 0, 1, 0, 1, 0, 1, 0];

export type GridLoaderProps = {
	className?: string;
	/** Tailwind background class for active cells, e.g. emerald for practice flows */
	cellClassName?: string;
	size?: "sm" | "md" | "lg";
};

const SIZE_PX = { sm: 28, md: 40, lg: 52 } as const;

export function GridLoader({
	className,
	cellClassName = "bg-emerald-500 shadow-[0_0_12px_color-mix(in_oklab,var(--color-emerald-500)_45%,transparent)] dark:bg-emerald-400 dark:shadow-[0_0_14px_color-mix(in_oklab,var(--color-emerald-400)_40%,transparent)]",
	size = "md",
}: GridLoaderProps) {
	const reduceMotion = useReducedMotion();
	const outer = SIZE_PX[size];
	const gap = 3;
	const cell = (outer - gap * 2) / 3;

	return (
		<div
			className={cn("inline-grid grid-cols-3 grid-rows-3", className)}
			style={{
				width: outer,
				height: outer,
				gap,
			}}
			aria-hidden
		>
			{PATTERN.map((on, i) => (
				<div
					key={i}
					className="flex items-center justify-center"
					style={{ width: cell, height: cell }}
				>
					{on ?
						reduceMotion ?
							<div className={cn("size-full rounded-[3px]", cellClassName)} style={{ opacity: 0.85 }} />
						:	<motion.div
								className={cn("size-full rounded-[3px]", cellClassName)}
								animate={{ opacity: [0.35, 1, 0.35], scale: [0.92, 1, 0.92] }}
								transition={{
									duration: 1.1,
									repeat: Number.POSITIVE_INFINITY,
									ease: "easeInOut",
									delay: (i % 5) * 0.07,
								}}
							/>
					:	null}
				</div>
			))}
		</div>
	);
}
