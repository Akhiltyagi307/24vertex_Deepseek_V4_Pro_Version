"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, GraduationCap, MoonStarIcon, SunIcon } from "lucide-react";
import { motion } from "motion/react";

import AnimatedToggle from "@/components/smoothui/animated-toggle";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { AuthTrustedStudentsGlassStrip } from "@/components/auth/auth-trusted-students-glass-strip";
import { LandingMobileNavSheet } from "@/components/marketing/landing-mobile-nav-sheet";
import { LandingPrimaryCtaButton } from "@/components/marketing/landing-primary-cta-button";
import { SchoolsMarquee } from "@/components/marketing/schools-marquee";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { landingFeatureBentoShell } from "@/lib/marketing/landing-feature-surface";
import { landingMarketingSectionEyebrowBadgeClassName } from "@/lib/marketing/landing-marketing-badge";
import {
	LANDING_MARKETING_HERO_CTA_ROW_GAP_CLASSNAME,
	LANDING_MARKETING_SECONDARY_CTA_BUTTON_CLASSNAME,
	LANDING_PARENT_PRIMARY_CTA_HREF,
	MARKETING_NAV,
} from "@/lib/marketing/landing-copy";
import {
	MARKETING_SECTION_INTRO_MAX_CLASSNAME,
	MARKETING_SECTION_LEAD_MAX_CLASSNAME,
} from "@/lib/marketing/marketing-section-rhythm";
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
                alt="24Vertex logo"
                width={40}
                height={40}
                priority
                sizes="(min-width: 48rem) 40px, 32px"
                className="size-8 shrink-0 object-contain medium:size-10"
              />
              <span>24Vertex</span>
            </Link>
          </div>
          <div className="hidden flex-1 items-center justify-center gap-6 xl:flex">
            <a
              href="/#how-it-works"
              className="text-muted-foreground hover:text-card-foreground hover:bg-muted/40 rounded-lg px-2 py-1 text-sm transition-colors"
            >
              How it works
            </a>
            <Link
              href={MARKETING_NAV.aiTutor.href}
              className="text-muted-foreground hover:text-card-foreground hover:bg-muted/40 rounded-lg px-2 py-1 text-sm transition-colors"
            >
              {MARKETING_NAV.aiTutor.label}
            </Link>
            <Link
              href={MARKETING_NAV.pricing.href}
              className="text-muted-foreground hover:text-card-foreground hover:bg-muted/40 rounded-lg px-2 py-1 text-sm transition-colors"
            >
              {MARKETING_NAV.pricing.label}
            </Link>
            <Link
              href={MARKETING_NAV.schools.href}
              className="text-muted-foreground hover:text-card-foreground hover:bg-muted/40 rounded-lg px-2 py-1 text-sm transition-colors"
            >
              {MARKETING_NAV.schools.label}
            </Link>
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
                  className="relative flex h-5 w-9 shrink-0 items-center justify-center rounded-full bg-background/85 p-0.5 shadow-sm dark:bg-foreground/22"
                  aria-busy="true"
                  aria-label="Loading theme toggle"
                >
                  <span className="flex size-4 items-center justify-center rounded-full bg-background text-foreground shadow-sm [&_svg]:size-3">
                    <SunIcon aria-hidden />
                  </span>
                </div>
              )}
            </div>
            <Separator orientation="vertical" className="bg-border h-7 medium:h-8" />
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
            <LandingMobileNavSheet />
          </div>
        </nav>
      </header>

      <div className="relative w-full">
        <section className="w-full overflow-x-hidden py-16 medium:py-24 xl:py-28">
          <motion.div
            className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 medium:px-6"
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex w-full flex-col items-center gap-8 text-center medium:gap-10 medium:gap-11">
              <motion.div
                className="mx-auto flex w-full max-w-4xl justify-center px-0.5"
                initial={false}
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
                      href="#problem"
                      className="inline-flex max-w-full items-center justify-center gap-1.5 text-pretty"
                    />
                  }
                >
                  <GraduationCap className="shrink-0 opacity-90" aria-hidden />
                  <span>For parents of grade 6 to 10 students. CBSE, ICSE, and state boards.</span>
                  <ChevronRight
                    className="size-3.5 shrink-0 opacity-70 transition-transform duration-200 ease-out group-hover/badge:translate-x-px"
                    aria-hidden
                  />
                </Badge>
              </motion.div>
              <motion.h1
                className={cn(
                  "text-foreground mx-auto w-full text-center text-pretty text-4xl font-medium leading-[1.08] tracking-tight medium:text-6xl medium:leading-[1.06] medium:text-7xl medium:leading-[1.05]",
                  MARKETING_SECTION_INTRO_MAX_CLASSNAME,
                )}
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="block">Find the weak chapter</span>
                <span className="mt-2 block text-[var(--subject-grid-icon)] medium:mt-2.5">
                  before report-card day.
                </span>
              </motion.h1>
              <motion.p
                className={cn(
                  "text-muted-foreground mx-auto w-full text-center text-pretty text-[0.9375rem] leading-relaxed medium:text-lg medium:leading-[1.65] medium:text-[1.0625rem]",
                  MARKETING_SECTION_LEAD_MAX_CLASSNAME,
                )}
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                24Vertex spots your child&rsquo;s weak chapters (chapter by chapter, in their
                actual textbook), while a private AI tutor handles the questions they would
                never raise in class.
              </motion.p>
              <motion.div
                className={cn(
                  "flex w-full max-w-4xl flex-col items-center medium:flex-row medium:items-center medium:justify-center",
                  LANDING_MARKETING_HERO_CTA_ROW_GAP_CLASSNAME,
                )}
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.24, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <LandingPrimaryCtaButton render={<Link href={LANDING_PARENT_PRIMARY_CTA_HREF} />} />
                <Button
                  variant="marketingSecondary"
                  className={LANDING_MARKETING_SECONDARY_CTA_BUTTON_CLASSNAME}
                  render={<Link href="#how-it-works" />}
                >
                  See how it works
                </Button>
              </motion.div>
              <motion.p
                className="mx-auto max-w-xl text-center text-xs text-muted-foreground/85 medium:text-sm"
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                14 days free. 5 practice tests, the AI tutor included. No card needed.
              </motion.p>
            </div>
          </motion.div>

          <motion.div
            className="relative left-1/2 mt-14 w-screen max-w-[100vw] -translate-x-1/2 medium:mt-16"
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <SchoolsMarquee />
            <div
              className={cn(
                "mx-auto mt-10 flex w-full justify-center px-1 medium:mt-12",
                MARKETING_SECTION_LEAD_MAX_CLASSNAME,
              )}
            >
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
