"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

type AnimatedToggleProps = {
	checked: boolean;
	onChange: (checked: boolean) => void;
	variant?: "icon";
	size?: "sm";
	label: string;
	icons: { on: React.ReactNode; off: React.ReactNode };
};

export default function AnimatedToggle({
	checked,
	onChange,
	label,
	icons,
}: AnimatedToggleProps) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={label}
			onClick={() => onChange(!checked)}
			className={cn(
				"relative inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors",
				checked
					? "bg-emerald-600 dark:bg-emerald-500"
					: "bg-background/85 dark:bg-foreground/22",
				"focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
			)}
		>
			<motion.span
				transition={{ type: "spring", stiffness: 500, damping: 32 }}
				className="flex size-4 items-center justify-center rounded-full bg-background text-foreground shadow-sm"
				initial={false}
				animate={{ x: checked ? 16 : 0 }}
			>
				<span className="flex size-3 items-center justify-center [&_svg]:size-3">
					{checked ? icons.on : icons.off}
				</span>
			</motion.span>
		</button>
	);
}
