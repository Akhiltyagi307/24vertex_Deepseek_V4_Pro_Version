"use client";

import * as React from "react";
import { useReducedMotion } from "motion/react";
import { Si1Password, SiGithub, SiMozilla } from "react-icons/si";

import { cn } from "@/lib/utils";

const logoIconClass =
  "h-6 w-auto shrink-0 text-muted-foreground opacity-[0.55] medium:h-7";

function TrustLogoStrip({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-x-14 medium:gap-x-20 medium:gap-x-24 [&_svg]:block",
        className,
      )}
    >
      <SiGithub className={logoIconClass} aria-hidden title="GitHub" />
      <SiMozilla className={logoIconClass} aria-hidden title="Mozilla" />
      <Si1Password className={logoIconClass} aria-hidden title="1Password" />
      <span
        className={cn(
          "select-none text-[1.125rem] font-semibold tracking-[0.12em] text-muted-foreground opacity-[0.55] medium:text-xl",
        )}
      >
        PwC
      </span>
    </div>
  );
}

/**
 * Infinite horizontal marquee of trust marks (transform-only animation).
 * Static, centered row when `prefers-reduced-motion: reduce` is set.
 */
export function LandingTrustMarquee() {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <div className="flex w-full justify-center px-4">
        <TrustLogoStrip />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative w-full overflow-hidden",
        "[mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]",
      )}
    >
      <div
        className="flex w-max animate-landing-trust-marquee will-change-transform group-hover:[animation-play-state:paused]"
        aria-hidden
      >
        <TrustLogoStrip className="pr-14 medium:pr-20 medium:pr-24" />
        <TrustLogoStrip className="pr-14 medium:pr-20 medium:pr-24" />
      </div>
    </div>
  );
}
