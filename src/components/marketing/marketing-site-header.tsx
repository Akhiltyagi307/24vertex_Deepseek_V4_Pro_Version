"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { MoonStarIcon, SunIcon } from "lucide-react";

import AnimatedToggle from "@/components/smoothui/animated-toggle";
import { useTheme } from "@/components/theme-provider";
import { LandingMobileNavSheet } from "@/components/marketing/landing-mobile-nav-sheet";
import { MarketingNavDropdown } from "@/components/marketing/marketing-nav-dropdown";
import { LandingPrimaryCtaButton } from "@/components/marketing/landing-primary-cta-button";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { landingFeatureBentoShell } from "@/lib/marketing/landing-feature-surface";
import {
	LANDING_MARKETING_HERO_CTA_ROW_GAP_CLASSNAME,
	LANDING_MARKETING_SECONDARY_CTA_BUTTON_CLASSNAME,
	LANDING_PARENT_PRIMARY_CTA_HREF,
} from "@/lib/marketing/landing-copy";
import {
	MARKETING_FEATURES_NAV,
	MARKETING_SOLUTIONS_NAV,
	MARKETING_UTILITY_NAV,
} from "@/lib/marketing/marketing-nav";
import { cn } from "@/lib/utils";

export function MarketingSiteHeader() {
	const [mounted, setMounted] = React.useState(false);
	React.useEffect(() => setMounted(true), []);

	const { resolvedTheme, setTheme } = useTheme();
	const isDark = (resolvedTheme ?? "dark") === "dark";
	const themeSwitchLabel = mounted ? (isDark ? "Switch to light theme" : "Switch to dark theme") : "Theme";

	return (
		<header className="sticky top-0 z-50 w-full bg-background/80 px-4 pt-3 backdrop-blur-md medium:px-6 xl:px-8">
			<nav
				className={cn(
					landingFeatureBentoShell,
					"mx-auto flex max-w-7xl items-center justify-between gap-3 rounded-xl px-4 py-2.5 shadow-lg medium:px-5 medium:py-3",
				)}
				aria-label="Site"
			>
				<Link
					href="/"
					className="text-card-foreground inline-flex items-center gap-2.5 text-lg font-semibold tracking-tight medium:gap-3 medium:text-xl"
				>
					<Image
						src="/brand/logo-icon.png"
						alt="24Vertex logo, the green chapter mastery mark"
						width={40}
						height={40}
						priority
						sizes="(min-width: 48rem) 40px, 32px"
						className="size-8 shrink-0 object-contain medium:size-10"
					/>
					<span>24Vertex</span>
				</Link>

				<div className="hidden flex-1 items-center justify-center gap-1 xl:flex">
					<MarketingNavDropdown label="Features" items={MARKETING_FEATURES_NAV} />
					<MarketingNavDropdown label="Solutions" items={MARKETING_SOLUTIONS_NAV} />
					{MARKETING_UTILITY_NAV.map((link) => (
						<Link
							key={link.href}
							href={link.href}
							className="text-muted-foreground hover:text-card-foreground hover:bg-muted/40 rounded-lg px-2 py-1 text-sm transition-colors"
						>
							{link.label}
						</Link>
					))}
				</div>

				<div className="flex items-center gap-2 medium:gap-3">
					<div className="border-border bg-muted/40 inline-flex shrink-0 items-center justify-center rounded-lg border p-1 shadow-sm">
						{mounted ? (
							<AnimatedToggle
								checked={isDark}
								onChange={(checked) => setTheme(checked ? "dark" : "light")}
								variant="icon"
								size="sm"
								label={themeSwitchLabel}
								icons={{
									on: <MoonStarIcon aria-hidden />,
									off: <SunIcon aria-hidden />,
								}}
							/>
						) : (
							<div
								className="relative flex h-5 w-9 shrink-0 items-center justify-center rounded-full bg-background/85 p-0.5 shadow-sm"
								aria-busy="true"
								aria-label="Loading theme toggle"
							>
								<span className="flex size-4 items-center justify-center rounded-full bg-background text-foreground shadow-sm [&_svg]:size-3">
									<SunIcon aria-hidden />
								</span>
							</div>
						)}
					</div>
					<Separator orientation="vertical" className="bg-border hidden h-7 xl:block medium:h-8" />
					<div
						className={cn(
							"hidden xl:flex xl:items-center",
							LANDING_MARKETING_HERO_CTA_ROW_GAP_CLASSNAME,
						)}
					>
						<LandingPrimaryCtaButton render={<Link href={LANDING_PARENT_PRIMARY_CTA_HREF} />} />
						<Button
							variant="marketingSecondary"
							className={LANDING_MARKETING_SECONDARY_CTA_BUTTON_CLASSNAME}
							render={<Link href="/login" />}
						>
							Log in
						</Button>
					</div>
					<LandingMobileNavSheet className="xl:hidden" />
				</div>
			</nav>
		</header>
	);
}
