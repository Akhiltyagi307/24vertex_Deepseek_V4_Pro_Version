"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, MoonStarIcon, SunIcon } from "lucide-react";

import AnimatedToggle from "@/components/smoothui/animated-toggle";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { LandingPrimaryCtaButton } from "@/components/marketing/landing-primary-cta-button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { landingFeatureBentoShell } from "@/lib/marketing/landing-feature-surface";
import {
	LANDING_MARKETING_HERO_CTA_ROW_GAP_CLASSNAME,
	LANDING_MARKETING_SECONDARY_CTA_BUTTON_CLASSNAME,
} from "@/lib/marketing/landing-copy";
import { cn } from "@/lib/utils";

/** Marketing landing top bar (theme, auth, anchors). Hero body lives elsewhere or is omitted intentionally. */
export function LandingMarketingNav() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const themeSwitchLabel = mounted ? (isDark ? "Switch to light theme" : "Switch to dark theme") : "Theme";

  return (
    <div className="relative w-full">
      <header className="relative z-20 pt-0.5">
        <nav
          className={cn(
            landingFeatureBentoShell,
            "flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 medium:px-4 medium:py-3",
            "shadow-[0_12px_40px_-16px_rgba(0,0,0,0.45)] dark:shadow-[0_16px_48px_-20px_rgba(0,0,0,0.55)]",
          )}
          aria-label="Primary"
        >
          <div className="flex min-w-0 items-center">
            <Link
              href="/#home"
              className="text-card-foreground ring-ring/40 hover:text-card-foreground inline-flex min-w-0 items-center gap-2.5 rounded-lg text-lg font-semibold tracking-tight outline-none transition-colors focus-visible:ring-2 medium:gap-3 medium:text-xl"
            >
              <img src="/brand/logo-icon.png" alt="" className="size-8 shrink-0 object-contain medium:size-10" />
              <span className="truncate">24vertex</span>
            </Link>
          </div>
          <div className="hidden flex-1 items-center justify-center gap-1 medium:flex">
            <a
              href="#features"
              className="text-muted-foreground hover:text-card-foreground hover:bg-muted/40 rounded-lg px-3 py-2 text-sm transition-colors"
            >
              Features
            </a>
            <a
              href="#pricing"
              className="text-muted-foreground hover:text-card-foreground hover:bg-muted/40 rounded-lg px-3 py-2 text-sm transition-colors"
            >
              Pricing
            </a>
            <a
              href="#testimonials"
              className="text-muted-foreground hover:text-card-foreground hover:bg-muted/40 rounded-lg px-3 py-2 text-sm transition-colors"
            >
              Benefits
            </a>
          </div>
          <div className="flex shrink-0 items-center gap-2 medium:gap-3">
            <div className="border-border bg-muted/40 inline-flex shrink-0 items-center justify-center rounded-lg border p-1 shadow-sm">
              {mounted ? (
                <AnimatedToggle
                  checked={isDark}
                  onChange={(checked) => setTheme(checked ? "dark" : "light")}
                  variant="icon"
                  size="sm"
                  label={themeSwitchLabel}
                  icons={{
                    on: <MoonStarIcon />,
                    off: <SunIcon />,
                  }}
                />
              ) : (
                <div
                  className="bg-muted/60 h-5 w-9 shrink-0 rounded-full"
                  aria-busy="true"
                  aria-label="Loading theme toggle"
                />
              )}
            </div>
            <div
              className={cn(
                "hidden medium:flex medium:items-center",
                LANDING_MARKETING_HERO_CTA_ROW_GAP_CLASSNAME,
              )}
            >
              <LandingPrimaryCtaButton render={<Link href="/signup/role-picker" />} />
              <Button
                variant="marketingSecondary"
                className={LANDING_MARKETING_SECONDARY_CTA_BUTTON_CLASSNAME}
                render={<Link href="/login" />}
              >
                Log in
              </Button>
            </div>
            <Sheet>
              <SheetTrigger
                render={<Button variant="ghost" size="icon-sm" className="medium:hidden" aria-label="Open menu" />}
              >
                <Menu className="size-[15px]" />
                <span className="sr-only">Open menu</span>
              </SheetTrigger>
              <SheetContent side="right" className="w-[240px] medium:w-[300px]">
                <nav className="flex flex-col gap-4">
                  <Link
                    href="/#home"
                    className="inline-flex items-center gap-2.5 text-base font-semibold tracking-tight text-foreground"
                  >
                    <img src="/brand/logo-icon.png" alt="" className="size-8 shrink-0 object-contain medium:size-9" />
                    <span>24vertex</span>
                  </Link>
                  <a href="#features" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                    Features
                  </a>
                  <a href="#pricing" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                    Pricing
                  </a>
                  <a href="#testimonials" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                    Benefits
                  </a>
                  <div
                    className={cn(
                      "flex flex-col items-center",
                      LANDING_MARKETING_HERO_CTA_ROW_GAP_CLASSNAME,
                    )}
                  >
                    <LandingPrimaryCtaButton render={<Link href="/signup/role-picker" />} />
                    <Button
                      variant="marketingSecondary"
                      className={LANDING_MARKETING_SECONDARY_CTA_BUTTON_CLASSNAME}
                      render={<Link href="/login" />}
                    >
                      Log in
                    </Button>
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
      </header>
    </div>
  );
}
