"use client";

import * as React from "react";
import { ArrowUpRight } from "lucide-react";

import { LANDING_ROLE_SIGNUP_PRIMARY_CTA } from "@/lib/marketing/landing-copy";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LandingPrimaryCtaButtonProps = {
	className?: string;
	render?: React.ComponentProps<typeof Button>["render"];
};

export function LandingPrimaryCtaButton({ className, render }: LandingPrimaryCtaButtonProps) {
	return (
		<Button
			render={render}
			className={cn(
				"group relative h-11 w-fit cursor-pointer overflow-hidden rounded-full border border-primary/70 bg-primary p-1 ps-5 pe-12 text-sm font-semibold text-primary-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.08)] transition-all duration-500 hover:ps-12 hover:pe-5 hover:bg-primary/90",
				className,
			)}
		>
			<span className="relative z-10 transition-all duration-500">{LANDING_ROLE_SIGNUP_PRIMARY_CTA}</span>
			<span className="absolute right-1 flex h-9 w-9 items-center justify-center rounded-full bg-black text-white transition-all duration-500 group-hover:right-[calc(100%-40px)] group-hover:rotate-45">
				<ArrowUpRight size={16} />
			</span>
		</Button>
	);
}
