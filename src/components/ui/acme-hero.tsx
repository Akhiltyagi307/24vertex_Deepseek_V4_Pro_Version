"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, GraduationCap, Menu, MoonStarIcon, School, SunIcon, Users } from "lucide-react";
import { motion } from "motion/react";

import AnimatedToggle from "@/components/smoothui/animated-toggle";
import { LANDING_ROLE_SIGNUP_PRIMARY_CTA } from "@/lib/marketing/landing-copy";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { LandingPrimaryCtaButton } from "@/components/marketing/landing-primary-cta-button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function AcmeHero() {
  const [mounted, setMounted] = React.useState(false);
  const [selectedRole, setSelectedRole] = React.useState<"student" | "parent" | "teacher">("student");
  React.useEffect(() => setMounted(true), []);

  const { resolvedTheme, setTheme } = useTheme();
  const isDark = (resolvedTheme ?? "dark") === "dark";
  const themeSwitchLabel = mounted ? (isDark ? "Switch to light theme" : "Switch to dark theme") : "Theme";
  const roleCards = [
    {
      id: "student" as const,
      title: "I am a Student",
      description: "Start focused practice in your own dashboard.",
      href: "/signup/student",
      icon: GraduationCap,
      action: "Start practice",
      helper: "14-day trial eligible",
    },
    {
      id: "parent" as const,
      title: "I am a Parent",
      description: "See your child's progress and assignments in one place.",
      href: "/signup/parent",
      icon: Users,
      action: "View child progress",
      helper: "Read-only oversight",
    },
    {
      id: "teacher" as const,
      title: "I am a Teacher",
      description: "Assign work, monitor classes, and act early.",
      href: "/signup/teacher",
      icon: School,
      action: "Open teacher portal",
      helper: "Class-level controls",
    },
  ] as const;
  const activeRole = roleCards.find((role) => role.id === selectedRole) ?? roleCards[0];
  const ActiveRoleIcon = activeRole.icon;

  return (
    <div className="w-full">
      <header className="relative pt-1">
        <nav className="flex items-center justify-between rounded-xl border bg-background px-4 py-2 shadow-lg">
          <div className="flex items-center">
            <a href="/#home" className="inline-flex items-center gap-2 text-base font-semibold">
              <img src="/brand/logo-icon.png" alt="24vertex logo" className="size-6 shrink-0 object-contain" />
              <span>24vertex</span>
            </a>
          </div>
          <div className="hidden flex-1 items-center justify-center gap-6 md:flex">
            <a href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#how-it-works" className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground lg:inline-flex">
              How it works
            </a>
            <a href="#pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Pricing
            </a>
            <a href="#benefits" className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground lg:inline-flex">
              Benefits
            </a>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex shrink-0 items-center justify-center rounded-md border border-border/90 bg-sidebar-accent p-1 shadow-sm dark:border-border dark:bg-sidebar-accent">
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
            <Separator orientation="vertical" className="h-6" />
            <Button
              variant="outline"
              size="sm"
              className="hidden h-10 rounded-full border-border/70 px-4 text-sm font-normal text-muted-foreground hover:text-foreground md:inline-flex"
              render={<Link href="/login" />}
            >
              Log in
            </Button>
            <LandingPrimaryCtaButton
              className="hidden md:inline-flex"
              render={<Link href="/signup/role-picker" />}
            />
            <Sheet>
              <SheetTrigger
                render={<Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="Open menu" />}
              >
                <Menu className="size-[15px]" />
                <span className="sr-only">Open menu</span>
              </SheetTrigger>
              <SheetContent side="right" className="w-[240px] sm:w-[300px]">
                <nav className="flex flex-col gap-4">
                  <a href="/#home" className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                    <img src="/brand/logo-icon.png" alt="24vertex logo" className="size-6 shrink-0 object-contain" />
                    <span>24vertex</span>
                  </a>
                  <Separator />
                  <a href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    Features
                  </a>
                  <a href="#benefits" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    Benefits
                  </a>
                  <a href="#how-it-works" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    How it works
                  </a>
                  <a href="#pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    Pricing
                  </a>
                  <Button
                    variant="ghost"
                    size="sm"
                  className="h-10 justify-start rounded-full px-4 text-sm font-normal text-muted-foreground hover:text-foreground"
                    render={<Link href="/login" />}
                  >
                    Log in
                  </Button>
                  <LandingPrimaryCtaButton render={<Link href="/signup/role-picker" />} />
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
      </header>

      <main className="relative w-full">
        <section className="w-full py-10 md:py-14 lg:py-16">
          <motion.div
            className="grid w-full gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <div className="flex flex-col gap-6 text-center lg:max-w-2xl lg:text-left">
              <motion.a
                href="#how-it-works"
                className="group mx-auto inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-background px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:mx-0"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08, duration: 0.3 }}
              >
                <BookOpenCheck className="size-4 text-primary transition-transform duration-300 group-hover:-rotate-6" />
                <span>Built for focused learning across all roles</span>
              </motion.a>
              <motion.h1
                className="text-balance text-4xl font-bold tracking-tighter sm:text-5xl lg:text-6xl"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.45 }}
              >
                Practice smarter, stay aligned across every role
              </motion.h1>
              <motion.p
                className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-xl lg:mx-0"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22, duration: 0.45 }}
              >
                EduAI gives students focused practice, keeps parents informed, and helps teachers act early with
                reliable class-level signals.
              </motion.p>
              <motion.div
                className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-start"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.45 }}
              >
                <LandingPrimaryCtaButton render={<Link href="/signup/role-picker" />} />
                <Button
                  variant="outline"
                  className="h-11 justify-start rounded-full border-primary bg-transparent px-6 text-sm font-semibold text-primary shadow-none hover:bg-primary/10 hover:text-primary"
                  render={<Link href="#features" />}
                >
                  Explore features first
                </Button>
              </motion.div>
            </div>
            <motion.div
              className="w-full rounded-3xl p-1"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <div className="relative mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border shadow-xl">
                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-start bg-gradient-to-b from-background/70 via-background/20 to-transparent px-4 py-3">
                  <span className="rounded-full border border-border/70 bg-background/75 px-2.5 py-1 text-xs text-muted-foreground">
                    Topic coverage + test velocity
                  </span>
                </div>
                <img
                  src="/hero-dashboard-preview.png"
                  alt="24vertex student dashboard preview with topic progress and practice insights"
                  className="h-full w-full rounded-3xl object-center"
                />
              </div>
            </motion.div>
          </motion.div>
          <motion.div
            className="mt-8 w-full space-y-3"
            aria-label="Role-specific signup guidance"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.45 }}
          >
            <p className="text-sm text-muted-foreground">Pick your role to continue in the matching portal.</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {roleCards.map((role) => {
                const Icon = role.icon;
                const isActive = role.id === selectedRole;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedRole(role.id)}
                    className={[
                      "inline-flex h-10 items-center justify-center gap-2 rounded-full border px-4 text-sm transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      isActive
                        ? "border-foreground bg-foreground text-background"
                        : "border-border/80 bg-background text-muted-foreground hover:border-border hover:text-foreground",
                    ].join(" ")}
                    aria-pressed={isActive}
                  >
                    <Icon className="size-4" />
                    <span>{role.title.replace("I am a ", "")}</span>
                  </button>
                );
              })}
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <ActiveRoleIcon className="size-3.5" />
                  <span>{activeRole.helper}</span>
                </div>
                <span className="text-xs text-muted-foreground">Step 1 of 2</span>
              </div>
              <p className="mt-3 text-xl font-semibold tracking-tight text-foreground">{activeRole.title}</p>
              <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">{activeRole.description}</p>
              <Button className="mt-4 h-10 rounded-full px-4 text-sm" render={<Link href={activeRole.href} />}>
                {activeRole.action}
                <ArrowRight className="ml-2 size-4" />
              </Button>
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
                <span>No payment details needed to begin.</span>
                <span aria-hidden className="text-muted-foreground/40">
                  ·
                </span>
                <Link href="/signup/role-picker" className="font-medium text-foreground underline-offset-4 hover:underline">
                  Compare roles first, you can switch anytime
                </Link>
              </div>
            </div>
          </motion.div>
        </section>
      </main>
    </div>
  );
}
