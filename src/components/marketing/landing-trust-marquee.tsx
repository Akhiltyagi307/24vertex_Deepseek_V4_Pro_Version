"use client";

import * as React from "react";
import { useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

const logoIconClass =
  "h-6 w-auto shrink-0 text-muted-foreground opacity-[0.55] medium:h-7";

interface BrandIconProps {
  className?: string;
  title?: string;
}

/**
 * Inline brand SVGs (paths sourced from Simple Icons via react-icons/si).
 * Inlined per PERFORMANCE_OPTIMIZATION_PLAN.md §1.4 to avoid pulling the entire
 * react-icons dependency into the bundle for three logos. Hot-fix follow-up to
 * PR #21 — the cleanup was completed for footer-7 but missed here.
 */
function GithubIcon({ className, title }: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-hidden focusable="false" className={className}>
      {title ? <title>{title}</title> : null}
      <path
        fill="currentColor"
        d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
      />
    </svg>
  );
}

function MozillaIcon({ className, title }: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-hidden focusable="false" className={className}>
      {title ? <title>{title}</title> : null}
      <path
        fill="currentColor"
        d="M4.819 24H1.75V0H4.82zM7.33 12.242H19.48v-.69L11.562 8.67V6.25l7.918-2.872v-.7H10.1V0h12.149v4.89l-6.445 2.224v.69l6.445 2.224v4.89H7.33zm0-9.565h2.77v2.77H7.33z"
      />
    </svg>
  );
}

function OnePasswordIcon({ className, title }: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-hidden focusable="false" className={className}>
      {title ? <title>{title}</title> : null}
      <path
        fill="currentColor"
        d="M12 .007C5.373.007 0 5.376 0 11.999c0 6.624 5.373 11.994 12 11.994S24 18.623 24 12C24 5.376 18.627.007 12 .007Zm-.895 4.857h1.788c.484 0 .729.002.914.096a.86.86 0 0 1 .377.377c.094.185.095.428.095.912v6.016c0 .12 0 .182-.015.238a.427.427 0 0 1-.067.137.923.923 0 0 1-.174.162l-.695.564c-.113.092-.17.138-.191.194a.216.216 0 0 0 0 .15c.02.055.078.101.191.193l.695.565c.094.076.14.115.174.162.03.042.053.087.067.137a.936.936 0 0 1 .015.238v2.746c0 .484-.001.727-.095.912a.86.86 0 0 1-.377.377c-.185.094-.43.096-.914.096h-1.788c-.484 0-.726-.002-.912-.096a.86.86 0 0 1-.377-.377c-.094-.185-.095-.428-.095-.912v-6.016c0-.12 0-.182.015-.238a.437.437 0 0 1 .067-.139c.034-.047.08-.083.174-.16l.695-.564c.113-.092.17-.138.191-.194a.216.216 0 0 0 0-.15c-.02-.055-.078-.101-.191-.193l-.695-.565a.92.92 0 0 1-.174-.162.437.437 0 0 1-.067-.139.92.92 0 0 1-.015-.236V6.25c0-.484.001-.727.095-.912a.86.86 0 0 1 .377-.377c.186-.094.428-.096.912-.096z"
      />
    </svg>
  );
}

function TrustLogoStrip({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-x-14 medium:gap-x-20 medium:gap-x-24 [&_svg]:block",
        className,
      )}
    >
      <GithubIcon className={logoIconClass} title="GitHub" />
      <MozillaIcon className={logoIconClass} title="Mozilla" />
      <OnePasswordIcon className={logoIconClass} title="1Password" />
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
