"use client";

import { motion, useReducedMotion } from "framer-motion";
import * as React from "react";

import { cn } from "@/lib/utils";

export type PageStaggerSection = {
	key: string;
	content: React.ReactNode;
};

function useStaggerVariants(enableLift: boolean) {
	const reduceMotion = useReducedMotion();
	const y = reduceMotion || !enableLift ? 0 : 8;
	const stagger = reduceMotion ? 0 : 0.05;
	const duration = reduceMotion ? 0 : 0.22;

	const container = React.useMemo(
		() => ({
			hidden: {},
			show: {
				transition: { staggerChildren: stagger, delayChildren: reduceMotion ? 0 : 0.02 },
			},
		}),
		[reduceMotion, stagger],
	);

	const item = React.useMemo(
		() => ({
			hidden: { opacity: reduceMotion ? 1 : 0, y },
			show: {
				opacity: 1,
				y: 0,
				transition: { duration, ease: "easeOut" as const },
			},
		}),
		[duration, reduceMotion, y],
	);

	return { container, item };
}

type PageStaggerRootProps = {
	className?: string;
	sections: PageStaggerSection[];
	/**
	 * When `false`, only opacity is staggered (no vertical offset). Prefer this under
	 * `app/student|parent/template.tsx` where the segment already does a short lift.
	 */
	enableLift?: boolean;
};

export function PageStaggerRoot({ className, sections, enableLift = true }: PageStaggerRootProps) {
	const { container, item } = useStaggerVariants(enableLift);

	return (
		<motion.div
			className={cn("min-w-0", className)}
			initial="hidden"
			animate="show"
			variants={container}
		>
			{sections.map(({ key, content }) => (
				<motion.div key={key} variants={item} className="min-w-0">
					{content}
				</motion.div>
			))}
		</motion.div>
	);
}
