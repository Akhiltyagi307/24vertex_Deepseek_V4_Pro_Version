"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, GraduationCap, Menu, MoonStarIcon, SunIcon } from "lucide-react";
import { motion } from "motion/react";

import AnimatedToggle from "@/components/smoothui/animated-toggle";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { AuthTrustedStudentsGlassStrip } from "@/components/auth/auth-trusted-students-glass-strip";
import { LandingPrimaryCtaButton } from "@/components/marketing/landing-primary-cta-button";
import { SchoolsMarquee } from "@/components/marketing/schools-marquee";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { landingFeatureBentoShell } from "@/lib/marketing/landing-feature-surface";
import { landingMarketingSectionEyebrowBadgeClassName } from "@/lib/marketing/landing-marketing-badge";
import {
	LANDING_MARKETING_HERO_CTA_ROW_GAP_CLASSNAME,
	LANDING_MARKETING_SECONDARY_CTA_BUTTON_CLASSNAME,
} from "@/lib/marketing/landing-copy";
import { cn } from "@/lib/utils";

export function AcmeHero() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const { resolvedTheme, setTheme } = useTheme();
  const isDark = (resolvedTheme ?? "dark") === "dark";
  const themeSwitchLabel = mounted ? (isDark ? "Switch to light theme" : "Switch to dark theme") : "Theme";

  return (
    <div className="w-full">
      <header className="relative pt-1">
        <nav
          className={cn(
            landingFeatureBentoShell,
            "flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 shadow-lg medium:px-5 medium:py-3",
          )}
        >
          <div className="flex items-center">
            <Link
              href="/#home"
              className="text-card-foreground inline-flex items-center gap-2.5 text-lg font-semibold tracking-tight medium:gap-3 medium:text-xl"
            >
              <Image
                src="/brand/logo-icon.png"
                alt="24vertex logo"
                width={40}
                height={40}
                priority
                className="size-8 shrink-0 object-contain medium:size-10"
              />
              <span>24vertex</span>
            </Link>
          </div>
          <div className="hidden flex-1 items-center justify-center gap-6 medium:flex">
            <a
              href="#features"
              className="text-muted-foreground hover:text-card-foreground hover:bg-muted/40 rounded-lg px-2 py-1 text-sm transition-colors"
            >
              Features
            </a>
            <a
              href="#pricing"
              className="text-muted-foreground hover:text-card-foreground hover:bg-muted/40 rounded-lg px-2 py-1 text-sm transition-colors"
            >
              Pricing
            </a>
            <a
              href="#benefits"
              className="text-muted-foreground hover:text-card-foreground hover:bg-muted/40 hidden rounded-lg px-2 py-1 text-sm transition-colors xl:inline-flex"
            >
              Benefits
            </a>
          </div>
          <div className="flex items-center gap-3">
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
                  className="h-5 w-9 shrink-0 rounded-full bg-muted/70"
                  aria-busy="true"
                  aria-label="Loading theme toggle"
                />
              )}
            </div>
            <Separator orientation="vertical" className="bg-border h-7 medium:h-8" />
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
                  <Link href="/#home" className="inline-flex items-center gap-2.5 text-base font-semibold tracking-tight text-foreground">
                    <Image src="/brand/logo-icon.png" alt="24vertex logo" width={36} height={36} className="size-8 shrink-0 object-contain medium:size-9" />
                    <span>24vertex</span>
                  </Link>
                  <Separator />
                  <a href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    Features
                  </a>
                  <a href="#benefits" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    Benefits
                  </a>
                  <a href="#pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    Pricing
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

      <div className="relative w-full">
        <section className="w-full overflow-x-hidden py-16 medium:py-24 xl:py-28">
          <motion.div
            className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 medium:px-6"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex w-full flex-col items-center gap-8 text-center medium:gap-10 medium:gap-11">
              <motion.div
                className="mx-auto flex w-full max-w-4xl justify-center px-0.5"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              >
                <Badge
                  variant="outline"
                  className={cn(
                    landingMarketingSectionEyebrowBadgeClassName,
                    "h-auto min-h-7 max-w-full gap-1.5 rounded-full px-3 py-1.5 text-center font-medium whitespace-normal leading-snug [a]:hover:bg-[var(--subject-grid-icon)]/14 [a]:hover:text-[var(--subject-grid-icon)] dark:[a]:hover:bg-[var(--subject-grid-icon)]/20",
                  )}
                  render={
                    <Link
                      href="#features"
                      className="inline-flex max-w-full items-center justify-center gap-1.5 text-pretty"
                    />
                  }
                >
                  <GraduationCap className="shrink-0 opacity-90" aria-hidden />
                  <span>Grades 6 to 12: practice, parent visibility, and class signals in one place</span>
                  <ChevronRight
                    className="size-3.5 shrink-0 opacity-70 transition-transform duration-200 ease-out group-hover/badge:translate-x-px"
                    aria-hidden
                  />
                </Badge>
              </motion.div>
              <motion.h1
                className="mx-auto w-full max-w-4xl text-center text-pretty text-4xl font-medium leading-[1.08] tracking-tight text-foreground medium:text-6xl medium:leading-[1.06] medium:text-7xl medium:leading-[1.05]"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="block whitespace-nowrap">Practice smarter</span>
                <span className="mt-2 block whitespace-nowrap text-[var(--subject-grid-icon)] medium:mt-2.5">
                  <span className="medium:hidden">Stay aligned, every role</span>
                  <span className="hidden medium:inline">Stay aligned across every role</span>
                </span>
              </motion.h1>
              <motion.p
                className="mx-auto flex w-full max-w-4xl flex-col items-stretch gap-2.5 text-center text-[0.9375rem] leading-relaxed text-muted-foreground medium:gap-3 medium:text-lg medium:leading-[1.65] medium:text-[1.0625rem]"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="text-pretty">
                  Parents see progress as it happens, not buried in tutor threads and screenshots.
                </span>
                <span className="text-pretty">
                  Schools get dependable class-level signals instead of stitching together homework{"\u00a0"}apps and
                  one-off reports.
                </span>
              </motion.p>
              <motion.div
                className={cn(
                  "flex w-full max-w-4xl flex-col items-center medium:flex-row medium:items-center medium:justify-center",
                  LANDING_MARKETING_HERO_CTA_ROW_GAP_CLASSNAME,
                )}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.24, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <LandingPrimaryCtaButton render={<Link href="/signup/role-picker" />} />
                <Button
                  variant="marketingSecondary"
                  className={LANDING_MARKETING_SECONDARY_CTA_BUTTON_CLASSNAME}
                  render={<Link href="#features" />}
                >
                  Explore features first
                </Button>
              </motion.div>
            </div>
          </motion.div>

          <motion.div
            className="relative left-1/2 mt-14 w-screen max-w-[100vw] -translate-x-1/2 medium:mt-16"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <SchoolsMarquee />
            <div className="mx-auto mt-10 flex w-full max-w-2xl justify-center px-1 medium:mt-12">
              <AuthTrustedStudentsGlassStrip
                prominence="hero"
                surface="soft"
                className="w-full medium:w-auto"
              />
            </div>
          </motion.div>
        </section>
      </div>
    </div>
  );
}
