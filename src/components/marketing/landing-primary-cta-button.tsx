"use client";

import * as React from "react";
import { ArrowUpRight } from "lucide-react";

import { LANDING_PARENT_PRIMARY_CTA_LABEL } from "@/lib/marketing/landing-copy";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LandingPrimaryCtaButtonProps = {
	className?: string;
	render?: React.ComponentProps<typeof Button>["render"];
	/**
	 * `rich` (default): sliding-icon green pill on neutral surfaces.
	 * `minimal`: flat green + white label for inline use.
	 * `on-committed`: white pill with brand-green text, for use on top of a
	 * `tone="committed"` CTA band where green-on-green would disappear.
	 */
	visual?: "rich" | "minimal" | "on-committed";
	/** Override the button label. Defaults to the parent-direct CTA copy. */
	label?: React.ReactNode;
};

export function LandingPrimaryCtaButton({
	className,
	render,
	visual = "rich",
	label = LANDING_PARENT_PRIMARY_CTA_LABEL,
}: LandingPrimaryCtaButtonProps) {
	if (visual === "minimal") {
		return (
			<Button
				render={render}
				className={cn(
					"h-9 rounded-md border-transparent bg-primary px-4 text-sm font-medium text-primary-foreground shadow-none transition-[background-color,color] duration-200 ease-out hover:bg-primary/90 hover:text-primary-foreground dark:text-white dark:hover:text-white",
					className,
				)}
			>
				{label}
			</Button>
		);
	}

	if (visual === "on-committed") {
		return (
			<Button
				render={render}
				className={cn(
					"group relative h-11 w-fit cursor-pointer overflow-hidden rounded-full border border-white/0 bg-white px-6 text-sm font-semibold text-[#1f7350] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.35)] transition-all duration-300 hover:bg-white/95 hover:text-[#1a5e44] focus-visible:bg-white/95",
					className,
				)}
			>
				<span className="relative z-10 inline-flex items-center gap-2">
					{label}
					<ArrowUpRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
				</span>
			</Button>
		);
	}

	// Rich variant geometry, locked together:
	//   button      h-9   (36px)
	//   inner pad   p-1   (4px each side) → inner well = 28px tall
	//   arrow chip  h-7   (28px) — fills the inner well exactly
	//   right gap   right-1 (4px) at rest
	//   slide-left target → calc(100% - 32px)  (28px chip + 4px right gap)
	//   leading pad ps-4 / pe-9 ↔ hover ps-9 / pe-4
	return (
		<Button
			render={render}
			className={cn(
				"group relative h-9 w-fit cursor-pointer overflow-hidden rounded-full border border-primary/70 bg-primary p-1 ps-4 pe-9 text-sm font-semibold text-primary-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.08)] transition-all duration-500 hover:ps-9 hover:pe-4 hover:bg-primary/90 focus-visible:ps-9 focus-visible:pe-4 focus-visible:bg-primary/90",
				className,
			)}
		>
			<span className="relative z-10 transition-all duration-500">{label}</span>
			<span className="absolute right-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black text-white shadow-none ring-0 transition-all duration-500 group-hover:right-[calc(100%-32px)] group-hover:rotate-45 group-focus-visible:right-[calc(100%-32px)] group-focus-visible:rotate-45">
				<ArrowUpRight className="text-white" size={13} aria-hidden />
			</span>
		</Button>
	);
}
