"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

type AnimateFormAlertProps = {
	show: boolean;
	/** Stable key for AnimatePresence (e.g. "login-error", "step-error"). */
	motionKey: string;
	children: React.ReactNode;
	className?: string;
};

export function AnimateFormAlert({ show, motionKey, children, className }: AnimateFormAlertProps) {
	const reduceMotion = useReducedMotion();
	const y = reduceMotion ? 0 : 8;
	const yExit = reduceMotion ? 0 : -4;
	const duration = reduceMotion ? 0 : 0.22;

	return (
		<AnimatePresence mode="wait">
			{show ? (
				<motion.div
					key={motionKey}
					className={className}
					initial={{ opacity: reduceMotion ? 1 : 0, y }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: reduceMotion ? 1 : 0, y: yExit }}
					transition={{ duration, ease: "easeOut" }}
				>
					{children}
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}
