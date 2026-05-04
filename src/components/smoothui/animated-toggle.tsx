"use client";

import * as React from "react";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";

type AnimatedToggleProps = {
	checked: boolean;
	onChange: (checked: boolean) => void;
	/** `icon` — sun/moon (theme). `plain` — thumb only, same track + motion. */
	variant?: "icon" | "plain";
	size?: "sm";
	/** Used as `aria-label` when `aria-labelledby` is not set. */
	label: string;
	icons?: { on: React.ReactNode; off: React.ReactNode };
	disabled?: boolean;
	"aria-labelledby"?: string;
	"aria-describedby"?: string;
};

export default function AnimatedToggle({
	checked,
	onChange,
	label,
	icons,
	variant = "icon",
	disabled = false,
	"aria-labelledby": ariaLabelledby,
	"aria-describedby": ariaDescribedby,
}: AnimatedToggleProps) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={ariaLabelledby ? undefined : label}
			aria-labelledby={ariaLabelledby}
			aria-describedby={ariaDescribedby}
			disabled={disabled}
			onClick={() => {
				if (!disabled) onChange(!checked);
			}}
			className={cn(
				"relative inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors",
				checked
					? "bg-emerald-600 dark:bg-emerald-500"
					: "bg-background/85 dark:bg-foreground/22",
				"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
				disabled && "cursor-not-allowed opacity-60",
			)}
		>
			<motion.span
				transition={{ type: "spring", stiffness: 500, damping: 32 }}
				className="flex size-4 items-center justify-center rounded-full bg-background text-foreground shadow-sm"
				initial={false}
				animate={{ x: checked ? 16 : 0 }}
			>
				{variant === "icon" && icons ? (
					<span className="flex size-3 items-center justify-center [&_svg]:size-3">
						{checked ? icons.on : icons.off}
					</span>
				) : null}
			</motion.span>
		</button>
	);
}
