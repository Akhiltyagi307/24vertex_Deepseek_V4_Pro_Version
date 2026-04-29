"use client";

import React, { useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

/** Max-chroma sRGB fills for hover — reads neon on the dark auth grid. */
const BOX_COLORS = [
	"rgb(0 255 255)",
	"rgb(255 0 220)",
	"rgb(65 255 0)",
	"rgb(255 255 0)",
	"rgb(255 0 60)",
	"rgb(218 0 255)",
	"rgb(0 195 255)",
	"rgb(255 77 0)",
	"rgb(255 0 255)",
] as const;

const cellFrame =
	"border-slate-700 transition-[background-color,opacity] duration-150 ease-out motion-reduce:transition-none";

/** Cell size between original (`h-8 w-16`) and the larger pass (`h-14 w-28`); row/col tuned for coverage. */
const ROWS = 100;
const COLS = 66;

export const BoxesCore = ({ className, ...rest }: { className?: string }) => {
	const rows = new Array(ROWS).fill(1);
	const cols = new Array(COLS).fill(1);
	const prefersReducedMotion = useReducedMotion();

	const onBoxPointerEnter = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (prefersReducedMotion) return;
			const el = e.currentTarget;
			const pick =
				BOX_COLORS[Math.floor(Math.random() * BOX_COLORS.length)] ?? BOX_COLORS[0];
			el.style.backgroundColor = pick;
			el.style.zIndex = "30";
		},
		[prefersReducedMotion],
	);

	const onBoxPointerLeave = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
		const el = e.currentTarget;
		el.style.backgroundColor = "";
		el.style.zIndex = "";
	}, []);

	return (
		<div className="pointer-events-auto absolute inset-0 z-0 min-h-full min-w-full overflow-hidden">
			<div
				style={{
					transform:
						"translate(-40%,-60%) skewX(-48deg) skewY(14deg) scale(0.8) rotate(0deg) translateZ(0)",
				}}
				className={cn(
					"isolate absolute left-1/4 z-0 flex h-full w-full -translate-x-1/2 -translate-y-1/2 p-4",
					"-top-1/4",
					className,
				)}
				{...rest}
			>
				{rows.map((_, i) => (
					<motion.div
						key={`row${i}`}
						className={cn("relative z-0 h-11 w-[5.5rem] border-l", cellFrame)}
					>
						{cols.map((_, j) => (
							<motion.div
								key={`col${j}`}
								onPointerEnter={onBoxPointerEnter}
								onPointerLeave={onBoxPointerLeave}
								className={cn("relative z-0 h-11 w-[5.5rem] border-r border-t", cellFrame)}
							>
								{j % 2 === 0 && i % 2 === 0 ? (
									<svg
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										strokeWidth="1.5"
										stroke="currentColor"
										className="pointer-events-none absolute -left-[28px] -top-[18px] h-8 w-[36px] stroke-[1px] text-slate-700"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M12 6v12m6-6H6"
										/>
									</svg>
								) : null}
							</motion.div>
						))}
					</motion.div>
				))}
			</div>
		</div>
	);
};

export const Boxes = React.memo(BoxesCore);
