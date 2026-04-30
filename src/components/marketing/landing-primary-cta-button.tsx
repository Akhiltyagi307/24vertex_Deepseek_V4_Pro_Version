"use client";

import * as React from "react";
import { ArrowUpRight } from "lucide-react";

import { LANDING_ROLE_SIGNUP_PRIMARY_CTA } from "@/lib/marketing/landing-copy";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LandingPrimaryCtaButtonProps = {
	className?: string;
	render?: React.ComponentProps<typeof Button>["render"];
	/** Flat green + white label (e.g. marketing hero). Default keeps the sliding icon treatment. */
	visual?: "rich" | "minimal";
};

export function LandingPrimaryCtaButton({
	className,
	render,
	visual = "rich",
}: LandingPrimaryCtaButtonProps) {
	if (visual === "minimal") {
		return (
			<Button
				render={render}
				className={cn(
					"h-10 rounded-md border-transparent bg-primary px-5 text-sm font-medium text-primary-foreground shadow-none transition-[background-color,color] duration-200 ease-out hover:bg-primary/90 hover:text-primary-foreground dark:text-white dark:hover:text-white",
					className,
				)}
			>
				{LANDING_ROLE_SIGNUP_PRIMARY_CTA}
			</Button>
		);
	}

	return (
		<Button
			render={render}
			className={cn(
				"group relative h-10 w-fit cursor-pointer overflow-hidden rounded-full border border-primary/70 bg-primary p-1 ps-5 pe-11 text-sm font-semibold text-primary-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.08)] transition-all duration-500 hover:ps-11 hover:pe-5 hover:bg-primary/90",
				className,
			)}
		>
			<span className="relative z-10 transition-all duration-500">{LANDING_ROLE_SIGNUP_PRIMARY_CTA}</span>
			<span className="absolute right-1 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black text-white shadow-none ring-0 transition-all duration-500 group-hover:right-[calc(100%-36px)] group-hover:rotate-45">
				<ArrowUpRight className="text-white" size={15} aria-hidden />
			</span>
		</Button>
	);
}
