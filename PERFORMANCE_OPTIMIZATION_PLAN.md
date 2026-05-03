# Page-Load Performance Optimization — Execution Plan

> Phase-2 deliverable for the audit in chat. Every Phase-1 finding (items A1–L8) is mapped here to a concrete, file-level change, a test/verification step, and a rollback note. Read top-to-bottom; phases are ordered so each builds on safety nets created earlier.

> **Scope:** Next.js 16 App Router + React 19 + Tailwind v4 + Supabase + Drizzle, deployed on Vercel.

---

## 0. Guiding Principles (read first — these stop us from breaking things)

1. **One concern per commit, one phase per PR.** If something regresses, `git revert` is one click.
2. **Measure before you change.** Phase 0 wires the analyzer + web-vitals. After that, every phase's "Verify" step compares numbers.
3. **Test the golden paths after every phase**, not just at the end:
   - Logged-out landing → signup → email confirm
   - Logged-out landing → login → student dashboard
   - Student: dashboard → practice (start a test) → submit → grading → reports
   - Student: doubt-chat ask + stream
   - Student: subscription page (Razorpay paywall opens)
   - Parent: select-student → dashboard → reports
   - Auth pages (login + signup) on dark mode + light mode
4. **Server-component conversions are the highest-risk bucket.** Always check Network tab for the chunk size delta and DOM for hydration warnings (browser console).
5. **Never `--no-verify`.** If a hook fails, fix the cause.
6. **Type-check + lint at every phase end:** `pnpm exec tsc --noEmit` and `pnpm lint`. Add `pnpm test` (vitest) once, then re-run.
7. **Visual regression check** after CSS / animation changes: open Storybook-style review of landing in both themes and on iPhone-12 emulation in DevTools. Lighthouse mobile run after every batch of landing-side fixes.
8. **Browser support invariants we must preserve:** working theme toggle (next-themes), `prefers-reduced-motion` honored, keyboard navigation, current CSP shape, Razorpay checkout still loads, Sentry still ingests.
9. **Worktree:** all work happens on the current branch `claude/romantic-pascal-2b647a`. Commit early, commit often.

---

## Phase 0 — Instrumentation (Baseline) [P0, ~1h, no user-visible change]

**Without numbers we can't prove wins. Do this first.**

### 0.1 Wire `@next/bundle-analyzer`

- Install: `pnpm add -D @next/bundle-analyzer`
- Edit [next.config.ts](next.config.ts):
  ```ts
  import type { NextConfig } from "next";
  import bundleAnalyzer from "@next/bundle-analyzer";

  const withBundleAnalyzer = bundleAnalyzer({
    enabled: process.env.ANALYZE === "true",
  });

  // ... existing nextConfig

  export default withBundleAnalyzer(nextConfig);
  ```
- Add script to [package.json](package.json) `"scripts"`:
  ```jsonc
  "analyze": "ANALYZE=true next build"
  ```
- **Verify:** `pnpm analyze` → 3 HTML reports open (client/edge/nodejs). Take screenshots of the **client** treemap; this is our baseline.

### 0.2 Wire web-vitals reporting

- Create [src/lib/observability/web-vitals.ts](src/lib/observability/web-vitals.ts):
  ```ts
  "use client";
  import { onCLS, onFCP, onINP, onLCP, onTTFB } from "web-vitals/attribution";
  import * as Sentry from "@sentry/nextjs";

  export function reportWebVitals() {
    const send = (metric: { name: string; value: number; id: string; rating?: string }) => {
      Sentry.captureMessage(`web-vital ${metric.name}`, {
        level: "info",
        tags: { metric: metric.name, rating: metric.rating ?? "unknown" },
        extra: { value: metric.value, id: metric.id },
      });
      if (process.env.NEXT_PUBLIC_VERCEL_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.log(`[web-vital] ${metric.name}`, metric.value, metric);
      }
    };
    onCLS(send);
    onFCP(send);
    onINP(send);
    onLCP(send);
    onTTFB(send);
  }
  ```
- Install dep: `pnpm add web-vitals`.
- Create a small client component `src/components/observability/web-vitals-island.tsx`:
  ```tsx
  "use client";
  import { useEffect } from "react";
  import { reportWebVitals } from "@/lib/observability/web-vitals";

  export function WebVitalsIsland() {
    useEffect(() => { reportWebVitals(); }, []);
    return null;
  }
  ```
- Mount it in [app/layout.tsx](app/layout.tsx) inside `<body>` after `<Providers>`.
- **Verify:** open landing in dev, console shows `[web-vital] LCP / CLS / INP` events. In production verify Sentry receives the messages.

### 0.3 Snapshot baseline metrics

- Run Lighthouse mobile (DevTools, slow-4G + 4× CPU) on:
  - `/` (landing)
  - `/login`
  - `/student/dashboard` (with a test user)
- Record: LCP, FCP, CLS, INP, transferred bytes, JS bytes. Stash in `PERF_BASELINE.txt` (gitignored if you want to keep it private).

> **Stop here. Commit Phase 0.**
> `git commit -m "perf(0): wire bundle-analyzer and web-vitals reporting"`

---

## Phase 1 — Dead Dependency Removal [P0, ~30m, low risk]

> Items C5, C6, plus dropping `motion` (handled in Phase 3 — split here so Phase 1 stays mechanical).

### 1.1 Remove `radix-ui` umbrella package (C5)

- **Pre-check:** `grep -rn "from \"radix-ui\"" --include="*.ts" --include="*.tsx" app/ src/` must return zero hits. (Already verified.)
- Edit [package.json](package.json) line 76: remove `"radix-ui": "^1.4.3",`.
- Run `pnpm install`.
- **Verify:** `pnpm exec tsc --noEmit` passes. `pnpm build` succeeds.

### 1.2 Remove `react-katex` (C6)

- **Pre-check:** `grep -rn "react-katex" --include="*.ts" --include="*.tsx" --include="*.mjs" .` returns 0 hits. (Already verified.)
- Edit [package.json](package.json) line 83: remove `"react-katex": "^3.1.0",`.
- Run `pnpm install`.
- **Verify:** same as 1.1.

### 1.3 Replace `react-icons/fa` (Footer7) with inline SVG (C3)

- Open [src/components/ui/footer-7.tsx](src/components/ui/footer-7.tsx).
- Replace line 4 import with inline SVG components or `lucide-react` equivalents (`Facebook, Instagram, Linkedin, Twitter`). Lucide has all four. Replace lines 60–65 default array's `icon:` JSX:
  ```tsx
  import { Facebook, Instagram, Linkedin, Twitter } from "lucide-react";
  // ...
  const defaultSocialLinks = [
    { icon: <Instagram className="size-5" />, href: "#", label: "Instagram" },
    { icon: <Facebook className="size-5" />, href: "#", label: "Facebook" },
    { icon: <Twitter className="size-5" />, href: "#", label: "Twitter" },
    { icon: <Linkedin className="size-5" />, href: "#", label: "LinkedIn" },
  ];
  ```
- **Verify:** load `/` in dev, scroll to footer, all 4 icons render. Lucide is already in `optimizePackageImports`, so this is a strict bundle reduction.

### 1.4 Replace `react-icons/si` (trust marquee) with inline SVG (C4)

- Open [src/components/marketing/landing-trust-marquee.tsx](src/components/marketing/landing-trust-marquee.tsx).
- The 3 SiGithub / SiMozilla / Si1Password are brand glyphs. Either:
  - **(Recommended)** Inline simplified SVGs from each brand's public guidelines (small, deterministic).
  - Or copy the SVG path strings out of the react-icons source and inline them as a dedicated `BrandLogos.tsx`.
- After both Footer7 and trust-marquee no longer import `react-icons`, run `grep -rn "react-icons" app/ src/`. If 0 hits → remove from [package.json](package.json) line 82.
- Run `pnpm install`.
- **Verify:** `pnpm build` succeeds, no broken icons in footer or trust strip on landing.

### 1.5 Phase-1 bundle delta

- `pnpm analyze` → diff client treemap vs Phase-0 baseline. Expect ~80–200 KB reduction in marketing chunk.

> **Commit:** `perf(1): remove dead deps (radix-ui, react-katex, react-icons)`

---

## Phase 2 — Static-Asset Wins [P0, ~1.5h, low–medium risk]

> Items A1, A2, A3, B1, B2, B3, J1, J2, J3, A6.

### 2.1 Replace 13 MB `subjects.gif` with a `<video>` (A1)

- **Goal:** drop initial transfer by ~12.5 MB without losing the visual.
- Convert `public/marketing/subjects.gif` to:
  - `subjects.mp4` (H.264, 24 fps, target ~400 KB)
  - `subjects.webm` (VP9, target ~300 KB)
  - One static poster frame `subjects-poster.webp` (~30 KB)
- Recommended local conversion command (run outside repo and copy result back):
  ```bash
  ffmpeg -i public/marketing/subjects.gif -movflags +faststart -pix_fmt yuv420p \
    -vf "scale='min(1280,iw)':-2" -c:v libx264 -crf 28 -preset slow -an public/marketing/subjects.mp4
  ffmpeg -i public/marketing/subjects.gif -c:v libvpx-vp9 -b:v 600K -an public/marketing/subjects.webm
  ffmpeg -i public/marketing/subjects.gif -frames:v 1 -c:v libwebp -q:v 70 public/marketing/subjects-poster.webp
  ```
- Edit [src/components/blocks/features-8.tsx](src/components/blocks/features-8.tsx) lines 147–159 — replace the `<img>` block:
  ```tsx
  <video
    className="size-full object-cover object-[center_35%] motion-reduce:hidden"
    src="/marketing/subjects.mp4"
    poster="/marketing/subjects-poster.webp"
    autoPlay
    loop
    muted
    playsInline
    preload="none"
    aria-hidden
  >
    <source src="/marketing/subjects.webm" type="video/webm" />
    <source src="/marketing/subjects.mp4" type="video/mp4" />
  </video>
  ```
  - Add a static `<img>` next to it under `motion-reduce:visible` for users with reduced motion (use the poster as src).
- After verification, **delete `public/marketing/subjects.gif`** from the repo (`git rm`) — it's the single biggest asset win.
- **Verify:** open landing, scroll to features bento, video plays once it autoplays (muted+playsInline allowed by Chrome/Safari/iOS). DevTools Network shows ~400 KB transfer instead of 13 MB. Reduced-motion fallback shows the poster.
- **Rollback:** keep gif in branch history; revert if business decides animation must be exact gif fidelity.

### 2.2 Delete unused `hero-dashboard-preview.png` (A2)

- `git rm public/hero-dashboard-preview.png`
- **Verify:** `grep -rn "hero-dashboard" app/ src/ public/` returns 0 hits (already verified). Build succeeds.

### 2.3 Convert `auth-fractal-glass.png` to AVIF/WebP (A3)

- Generate two derivatives:
  ```bash
  cwebp -q 80 public/brand/auth-fractal-glass.png -o public/brand/auth-fractal-glass.webp
  npx @squoosh/cli --avif '{"cqLevel":33}' public/brand/auth-fractal-glass.png -d public/brand/
  ```
- Use `next/image` with the PNG kept as fallback. Edit [src/components/auth/auth-studio-card.tsx](src/components/auth/auth-studio-card.tsx) lines 35–42:
  - Change `priority={false}` → `priority` if confirmed it's the LCP element on auth pages (likely yes on desktop).
  - Optionally use `<picture>` + `<source>` chain for AVIF/WebP/PNG. **Or simpler:** keep `next/image` pointing at the AVIF (Next 16 serves AVIF/WebP automatically when input is AVIF) and let it derive from there.
- **Verify:** open `/login`, DevTools Network shows AVIF/WebP load (`Accept` header negotiates). LCP ≤ previous.

### 2.4 Tighten Geist font weights (B1)

- Edit [app/layout.tsx](app/layout.tsx) line 7:
  ```ts
  const geist = Geist({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"], // was: undefined → all 9 weights
    display: "swap",
    variable: "--font-sans",
  });
  ```
- **Pre-check:** grep for any text elements relying on `font-extrabold` (800) / `font-thin` (100) / `font-light` (300) / `font-extralight` (200) / `font-black` (900). Found in `single-pricing-card-1.tsx` lines 83 and 133 (`font-extrabold`). **Action:** add `"800"` to the weight array OR change those two utilities to `font-bold` (700) — pick one. Recommended: add `"800"` since `font-extrabold` is intentional for the price.
- Final array: `["400", "500", "600", "700", "800"]`.
- **Verify:** load landing/auth/dashboard, DevTools Network only fetches the listed weights. No visual regressions on price tiles or headers.

### 2.5 Drop `--font-heading` alias (B3)

- Edit [app/globals.css](app/globals.css) line 8: delete `--font-heading: var(--font-sans);` line if confirmed not referenced anywhere.
- **Pre-check:** `grep -rn "font-heading" app/ src/` — keep it if any utility class uses it.

### 2.6 Use `next/image` for hero logo and avatars (J1, J2)

- [src/components/ui/acme-hero.tsx:48](src/components/ui/acme-hero.tsx) — replace `<img src="/brand/logo-icon.png">` (and the duplicate at line 123) with:
  ```tsx
  import Image from "next/image";
  // ...
  <Image src="/brand/logo-icon.png" alt="24vertex logo" width={40} height={40} priority className="size-8 shrink-0 object-contain sm:size-10" />
  ```
- Same change in [src/components/marketing/landing-marketing-nav.tsx:44](src/components/marketing/landing-marketing-nav.tsx), `:118`, [src/components/marketing/landing-site-header.tsx:69](src/components/marketing/landing-site-header.tsx), `:85`, `:134`, [src/components/ui/footer-7.tsx:92](src/components/ui/footer-7.tsx).
- For Supabase avatar URLs in [src/components/student/student-avatar-upload.tsx](src/components/student/student-avatar-upload.tsx) and [src/components/student/student-nav-user.tsx](src/components/student/student-nav-user.tsx) — already uses Avatar/AvatarImage from shadcn (which is a plain `<img>`). Wrap with `next/image` indirectly by replacing the underlying image with `next/image` inside the Avatar UI primitive, OR pass a Supabase render-API URL with `?width=80&quality=80&resize=cover`.
- **Verify:** Lighthouse Image audit no longer flags these.

### 2.7 Set `priority` + `fetchPriority="high"` on the LCP image per route (J3)

- Identify LCP per route via Lighthouse: landing → likely the H1 text (no image — skip), `/login` → fractal panel (set priority — already in 2.3), `/student/dashboard` → likely the hero card or a chart skeleton (no image — skip).
- Default rule: any `<Image>` above the fold gets `priority` + `fetchPriority="high"`. Below the fold gets the default `loading="lazy"`.

### 2.8 Add `manifest`, `apple-icon`, `opengraph-image` (A6)

- Create [app/manifest.ts](app/manifest.ts):
  ```ts
  import type { MetadataRoute } from "next";
  export default function manifest(): MetadataRoute.Manifest {
    return {
      name: "EduAI",
      short_name: "EduAI",
      description: "Adaptive assessment and practice",
      start_url: "/",
      display: "standalone",
      background_color: "#0a0a0a",
      theme_color: "#2ea070",
      icons: [{ src: "/brand/logo-icon.png", sizes: "192x192", type: "image/png" }],
    };
  }
  ```
- Create [app/apple-icon.png](app/apple-icon.png): 180×180 PNG, copy/resize from logo-icon.
- Create [app/opengraph-image.tsx](app/opengraph-image.tsx) using `ImageResponse` (Next 16 docs).
- Update middleware matcher in Phase 7 to skip these (G2).
- **Verify:** Lighthouse PWA audit; `/manifest.webmanifest` resolves; `/apple-icon.png` resolves; `/opengraph-image.png` resolves.

> **Commit:** `perf(2): static asset wins (gif→video, font weights, image conv)`. Run `pnpm analyze` and Lighthouse mobile on `/`, `/login`. Save deltas.

---

## Phase 3 — Animation Library Consolidation [P0, ~2h, medium risk]

> Item C1 — most visible win, but spans many files. Be methodical.

### 3.1 Decision

- **Standardize on `motion`** (the maintained successor of `framer-motion`; same API surface for v12). 18 files import from `framer-motion`, 5 from `motion/react`. The 5 are easier to migrate to `framer-motion`, but the right long-term direction is `motion`.
- **Action:** migrate all 18 `framer-motion` imports → `motion/react`, then drop `framer-motion`.

### 3.2 Codemod (mechanical edits)

For each of these files, replace `from "framer-motion"` with `from "motion/react"`:

1. [src/components/ui/border-trail.tsx:4-5](src/components/ui/border-trail.tsx)
2. [src/components/ui/single-pricing-card-1.tsx:5](src/components/ui/single-pricing-card-1.tsx)
3. [src/components/ui/background-boxes.tsx:4](src/components/ui/background-boxes.tsx)
4. [src/components/layout/app-header-brand-trail.tsx:4](src/components/layout/app-header-brand-trail.tsx)
5. [src/components/student/student-dashboard-view.tsx:7](src/components/student/student-dashboard-view.tsx)
6. [src/components/student/student-reports-view.tsx:21](src/components/student/student-reports-view.tsx)
7. [src/components/student/student-dashboard-analytics.tsx:16](src/components/student/student-dashboard-analytics.tsx)
8. [src/components/student/dashboard-other-subjects-table.tsx:6](src/components/student/dashboard-other-subjects-table.tsx)
9. [src/components/student/subscription/sidebar-plan-card.tsx:4](src/components/student/subscription/sidebar-plan-card.tsx)
10. [src/components/student/student-performance-view.tsx:21](src/components/student/student-performance-view.tsx)
11. [src/components/student/doubt/doubt-chat-view.tsx:10](src/components/student/doubt/doubt-chat-view.tsx)
12. [src/components/motion/suspense-content-reveal.tsx:3](src/components/motion/suspense-content-reveal.tsx)
13. [src/components/smoothui/animated-toggle.tsx:4](src/components/smoothui/animated-toggle.tsx)
14. [src/components/motion/segment-page-transition.tsx:3](src/components/motion/segment-page-transition.tsx)
15. [src/components/motion/page-stagger-root.tsx:3](src/components/motion/page-stagger-root.tsx)
16. [src/components/motion/animate-form-alert.tsx:4](src/components/motion/animate-form-alert.tsx)
17. [src/components/motion/motion-page-enter.tsx:3](src/components/motion/motion-page-enter.tsx)
18. (any straggler — re-grep `from "framer-motion"`)

Quick sed-style codemod (run from repo root, then visually review the diff):
```bash
grep -rl "from \"framer-motion\"" app/ src/ --include="*.tsx" --include="*.ts" \
  | xargs sed -i '' 's|from "framer-motion"|from "motion/react"|g'
grep -rl "from 'framer-motion'" app/ src/ --include="*.tsx" --include="*.ts" \
  | xargs sed -i '' "s|from 'framer-motion'|from 'motion/react'|g"
```
Also handle `import type { Transition } from 'framer-motion'` → `from 'motion/react'`.

### 3.3 Drop `framer-motion`

- Edit [package.json](package.json) line 69: remove `"framer-motion": "^12.38.0",`.
- `pnpm install`.
- **Verify:** `pnpm exec tsc --noEmit` passes; `pnpm build` succeeds; manually open every animated surface (landing hero, dashboard analytics, reports, performance, doubt-chat) and confirm animations still play.

### 3.4 Add `motion` to `optimizePackageImports`

- See Phase 4 for the consolidated config edit. Don't ship Phase 3 without Phase 4.

### 3.5 Cleanup `motion-page-enter` for landing (E1)

- Decide: do we still want a page-enter fade on landing? Recommendation: **no** — it delays LCP. Either:
  - Remove `<MotionPageEnter>` wrapper from [app/page.tsx:31](app/page.tsx) and replace with `<div>`.
  - Or rewrite `MotionPageEnter` as a CSS-only `@starting-style { opacity: 0 }` so it's free.
- Migrate to CSS-only version of MotionPageEnter (zero-JS):
  ```tsx
  // src/components/motion/motion-page-enter.tsx (rewrite — keeps API compatible)
  import type { ReactNode } from "react";
  import { cn } from "@/lib/utils";
  export function MotionPageEnter({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cn("min-w-0 w-full motion-page-enter", className)}>{children}</div>;
  }
  ```
  Then in [app/globals.css](app/globals.css):
  ```css
  @keyframes motion-page-enter {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .motion-page-enter { animation: motion-page-enter .24s cubic-bezier(.25,.1,.25,1) both; }
  @media (prefers-reduced-motion: reduce) { .motion-page-enter { animation: none; } }
  ```
- **Verify:** landing renders, fade still happens, but bundle is lighter and HTML paints before JS hydrates.

> **Commit:** `perf(3): consolidate motion lib (drop framer-motion, CSS-only landing enter)`

---

## Phase 4 — Next.js Config Knobs [P0, ~30m, low risk]

> Items C9, F1, F2, F3, F4, F5, F7, F8, F9, F10, G2.

Edit [next.config.ts](next.config.ts):

```ts
import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

// ... keep existing supabaseStorageRemotePatterns and contentSecurityPolicy helpers

const nextConfig: NextConfig = {
  reactStrictMode: true,                         // F8
  compress: true,                                // F7
  poweredByHeader: false,
  experimental: {
    ppr: "incremental",                          // F1
    optimizePackageImports: [                    // C9 / F3
      "lucide-react",
      "recharts",
      "motion",
      "@radix-ui/react-avatar",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-label",
      "@radix-ui/react-popover",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slot",
      "@radix-ui/react-toggle",
      "@radix-ui/react-toggle-group",
      "@radix-ui/react-tooltip",
      "date-fns",
      "@tiptap/core",
      "@tiptap/react",
      "@tiptap/starter-kit",
    ],
  },
  serverExternalPackages: [                      // F2
    "@sentry/nextjs",
    "drizzle-orm",
    "postgres",
    "@react-pdf/renderer",
    "razorpay",
    "resend",
  ],
  images: {
    formats: ["image/avif", "image/webp"],       // F9
    minimumCacheTTL: 60 * 60 * 24 * 365,         // F9
    remotePatterns: [
      ...supabaseStorageRemotePatterns(),
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
    ],
    dangerouslyAllowSVG: false,
  },
  async headers() {
    const base = [/* ... existing ... */];
    return [
      // F4 — long cache for hashed-immutable Next assets handled by Next defaults.
      // Add explicit immutable cache for our public/ assets:
      {
        source: "/:all*(svg|jpg|jpeg|png|gif|webp|avif|ico|mp4|webm)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      // F5 — security headers for everything EXCEPT static chunks (Next already
      // serves immutable headers for /_next/static and skipping CSP overhead is fine).
      { source: "/((?!_next/static|_next/image).*)", headers: base },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
```

### 4.1 Bump tsconfig target (F10)

- Edit [tsconfig.json](tsconfig.json) line 3: `"target": "ES2017"` → `"target": "ES2022"`.
- **Verify:** build succeeds. Output JS is smaller (no `Object.entries`/`async`/etc. polyfills).

### 4.2 Enable PPR per route (F1)

- For prerenderable routes (landing, legal, login shell), add at the top of the page module:
  ```ts
  export const experimental_ppr = true;
  ```
- Apply to: `app/page.tsx`, `app/legal/*/page.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/signup/role-picker/page.tsx`.
- For `app/student/dashboard/page.tsx` — keep `dynamic = "force-dynamic"` for now (data is per-user); revisit after Phase 7.
- **Verify:** build output prints `◐ (PPR)` for each opted-in route.

### 4.3 Force-static legal pages (G10)

- For `app/legal/{privacy,terms,refund,shipping}/page.tsx`, replace `MotionPageEnter` (already migrating in Phase 3) and add:
  ```ts
  export const dynamic = "force-static";
  export const revalidate = 86400;
  ```
- **Verify:** build output marks them as `○ (Static)`.

> **Commit:** `perf(4): tighten next.config (PPR, optimizePackageImports, ES2022, headers)`

---

## Phase 5 — Marketing/Landing Tree [P0–P1, ~3–4h, medium risk]

> Items A4, B-residual, C2, D3, D6, D7, E1 (residual), E2, E3, E4, E5, J1 (mop-up).

### 5.1 Lazy-load Three.js DottedSurface (C2, E2)

- Edit [src/components/marketing/landing-marketing-body.tsx](src/components/marketing/landing-marketing-body.tsx):
  ```tsx
  import dynamic from "next/dynamic";
  const DottedSurface = dynamic(
    () => import("@/components/ui/dotted-surface").then(m => ({ default: m.DottedSurface })),
    { ssr: false, loading: () => null },
  );
  ```
  Remove the static import on line 9.
- Even better — gate on `IntersectionObserver` so it only mounts when the CTA section is near-viewport. Wrap in a small `<LazyVisible>` helper:
  ```tsx
  // src/components/util/lazy-visible.tsx
  "use client";
  import { useEffect, useRef, useState } from "react";
  export function LazyVisible({ children, rootMargin = "200px" }: { children: React.ReactNode; rootMargin?: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const [show, setShow] = useState(false);
    useEffect(() => {
      const el = ref.current;
      if (!el) return;
      const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShow(true); io.disconnect(); } }, { rootMargin });
      io.observe(el);
      return () => io.disconnect();
    }, [rootMargin]);
    return <div ref={ref}>{show ? children : null}</div>;
  }
  ```
  Then `<LazyVisible><DottedSurface ... /></LazyVisible>` in the CTA section.
- **Verify:** scroll to CTA, Three.js chunk now appears in Network tab only at that moment. Initial landing JS drops by ~600 KB.

### 5.2 Pause off-screen marquees (E3)

- In [app/globals.css](app/globals.css), wrap `.landing-schools-marquee-track` animation start in a class added by IntersectionObserver, OR more simply use `animation-play-state` toggled by hover (already there) plus a CSS containment hint:
  ```css
  .landing-schools-marquee-track { contain: layout paint; will-change: auto; }
  ```
- Add an `IntersectionObserver` to [src/components/marketing/schools-marquee.tsx](src/components/marketing/schools-marquee.tsx) that toggles `animation-play-state: paused` when the strip is off-screen. Same for `.animate-landing-trust-marquee` in `landing-trust-marquee.tsx`.
- Implementation note: don't add another `useState`. Use a ref + IntersectionObserver that mutates `style.animationPlayState`.

### 5.3 CSS-replace pricing tile `whileInView` (E4)

- [src/components/ui/single-pricing-card-1.tsx](src/components/ui/single-pricing-card-1.tsx) — both `motion.div` blocks.
- Replace each with a regular `<div>` + a Tailwind class that uses CSS `@scroll-timeline` or simply a `transition-opacity duration-700 will-change-[opacity,transform]` plus a `data-[in-view=true]` attribute toggled by IntersectionObserver.
- Easiest: drop the entrance animation entirely (CSS opacity stays at 1). The pricing section has its own visual emphasis; the entrance animation isn't load-bearing.
- **Verify:** Pricing visually loads instantly. No motion library on this component.

### 5.4 Pause CPU-architecture animation off-screen (E5)

- Same pattern as 5.2 — wrap `<CpuArchitecture>` in `<LazyVisible>` so its 8 keyframe lines don't run until visible.

### 5.5 Replace `useState`+`useEffect` mounted guards (D6, D7)

- [src/components/marketing/landing-marketing-nav.tsx:21-22](src/components/marketing/landing-marketing-nav.tsx) and [src/components/ui/acme-hero.tsx:26-27](src/components/ui/acme-hero.tsx).
- Strategy: the mounted flag exists to dodge "server: light" vs "client: dark" hydration mismatch on the toggle. Use `next-themes`' `disableTransitionOnChange` (already enabled) + read `resolvedTheme` only inside an `<AnimatedToggle>` island, **without** gating the rest of the nav. Allow the toggle to render `null` first paint and hydrate later — or render a `<span suppressHydrationWarning>` placeholder.
- Refactor: extract just the toggle into `<MarketingThemeToggleIsland>` (`"use client"`), keep nav as a plain server-friendly export. (For nav to be a server component, must also remove the `<Sheet>` mobile menu hooks — see 5.6.)

### 5.6 Mobile menu without `useState` (D7)

- [src/components/marketing/landing-site-header.tsx:58](src/components/marketing/landing-site-header.tsx) uses `useState` only for `sheetOpen`.
- The `<Sheet>` primitive supports uncontrolled mode (drop the `open`/`onOpenChange` props and let it manage its own state internally). Then this file no longer needs `useState`/`useEffect` and could be server-rendered — but `<Sheet>` itself is a client component, so we still ship its JS. Net win is small but the boundary is cleaner.
- **Alternative:** keep the file client; cost is small. Don't waste time fighting Radix here. Skip if low priority.

### 5.7 Make `HomeMarketingShell` a server component (D3)

- The only client behavior in [src/components/marketing/home-marketing-shell.tsx](src/components/marketing/home-marketing-shell.tsx) is `useMarketingThemeSync()`.
- Refactor:
  - `home-marketing-shell.tsx` becomes a server component that renders a `<div>` plus a `<MarketingThemeSyncIsland />` (new tiny client component).
  - `<MarketingThemeSyncIsland>` is `"use client"`, calls `useMarketingThemeSync()` and returns `null`.
- Diff:
  ```tsx
  // home-marketing-shell.tsx (no "use client")
  import { cn } from "@/lib/utils";
  import { MarketingThemeSyncIsland } from "@/components/marketing/marketing-theme-sync-island";
  export function HomeMarketingShell({ className, children }: { className?: string; children: React.ReactNode }) {
    return (
      <div className={cn("box-border min-h-screen min-w-0 w-full overflow-x-clip bg-transparent", className)}>
        <MarketingThemeSyncIsland />
        {children}
      </div>
    );
  }
  ```
  ```tsx
  // marketing-theme-sync-island.tsx
  "use client";
  import { useMarketingThemeSync } from "@/components/marketing/use-marketing-theme-sync";
  export function MarketingThemeSyncIsland() { useMarketingThemeSync(); return null; }
  ```
- **Verify:** landing renders on cold load, theme toggle still works, dark/light styles still applied. No hydration warnings in console.

### 5.8 Acme-hero motion staggers — drop or simplify (E1 residual)

- [src/components/ui/acme-hero.tsx](src/components/ui/acme-hero.tsx) has 5 sequential `motion.div`/`motion.h1`/`motion.p` blocks with delays 0/0.06/0.12/0.18/0.24.
- These cause LCP to wait. Either:
  - **Recommended:** Remove the staggers entirely; rely on `MotionPageEnter`'s CSS-only fade.
  - Or convert each to CSS keyframe with `animation-delay`. Same visual, zero JS.
- Concrete CSS replacement (add to globals.css):
  ```css
  @keyframes hero-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
  .hero-rise > * { opacity: 0; animation: hero-rise .5s cubic-bezier(.22,1,.36,1) both; }
  .hero-rise > *:nth-child(1) { animation-delay: 0ms; }
  .hero-rise > *:nth-child(2) { animation-delay: 60ms; }
  .hero-rise > *:nth-child(3) { animation-delay: 120ms; }
  .hero-rise > *:nth-child(4) { animation-delay: 180ms; }
  .hero-rise > *:nth-child(5) { animation-delay: 240ms; }
  @media (prefers-reduced-motion: reduce) { .hero-rise > * { animation: none; opacity: 1; } }
  ```
  Then the hero markup becomes a normal `<div className="hero-rise">` with plain children.
- Once converted, `acme-hero.tsx` no longer imports `motion`. If it's the last consumer, this lets Next prune it more aggressively.

### 5.9 Drop the `motion.div` outer wrapper in [features-8.tsx](src/components/blocks/features-8.tsx)

- Already plain — verify. (This file is a server component, fine.)

### 5.10 Pricing card: no motion (covered by 5.3)

> **Commit:** `perf(5): landing tree — server-render shell, lazy three.js, CSS animations`. Lighthouse mobile run.

---

## Phase 6 — Authenticated Shell Refactor [P0, ~3–4h, HIGHER risk]

> Items D1, D2, D5, D8, D9, K1, K2.
>
> **Read this whole phase before editing.** Authenticated routes are where most users live; one misplaced `usePathname` import will turn a server component back into client.

### 6.1 Make `StudentShell` a server component (D1)

Current state: [src/components/student/student-shell.tsx](src/components/student/student-shell.tsx) is `"use client"` because of `usePathname` (line 39) and `useState` for `sidebarOpen` (lines 40, 44).

Plan:
1. Remove `"use client"` from `student-shell.tsx`.
2. Move the small interactive piece (sidebar open state + pathname-detection) into a tiny client island:
   ```tsx
   // src/components/student/student-shell-client-island.tsx
   "use client";
   import * as React from "react";
   import { usePathname } from "next/navigation";
   import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
   import { isStudentDoubtChatPath, isStudentImmersiveShellPath, isStudentPracticeTestSessionPath } from "@/lib/navigation/shell-immersive-paths";
   import { cn } from "@/lib/utils";

   export function StudentShellSidebarController({
     sidebar, topBar, children,
   }: { sidebar: React.ReactNode; topBar: React.ReactNode; children: React.ReactNode }) {
     const pathname = usePathname();
     const [sidebarOpen, setSidebarOpen] = React.useState(() => !isStudentPracticeTestSessionPath(pathname));
     React.useEffect(() => {
       if (isStudentPracticeTestSessionPath(pathname)) setSidebarOpen(false);
     }, [pathname]);
     const doubtChat = isStudentDoubtChatPath(pathname);
     const immersiveShell = isStudentImmersiveShellPath(pathname);
     return (
       <SidebarProvider className={cn("flex w-full flex-col", doubtChat ? "h-dvh max-h-dvh min-h-0 overflow-hidden" : "min-h-svh")} open={sidebarOpen} onOpenChange={setSidebarOpen}>
         {topBar}
         <div className={cn("flex min-h-0 w-full min-w-0 flex-1 items-stretch", doubtChat && "overflow-hidden")}>
           {sidebar}
           <SidebarInset className={cn(doubtChat ? "min-h-0 min-w-0 grow basis-0 overflow-hidden bg-background" : "min-h-0 min-w-0 grow basis-0 overflow-auto bg-background", !immersiveShell && "px-4 md:px-6 lg:px-8")}>
             {children}
           </SidebarInset>
         </div>
       </SidebarProvider>
     );
   }
   ```
3. Rewrite `student-shell.tsx` (server component) that composes `<StudentShellSidebarController>` with already-rendered server-side children:
   ```tsx
   // student-shell.tsx (no "use client")
   import { PaywallProvider } from "@/components/student/subscription/paywall-dialog";
   import { StudentAppSidebar } from "@/components/student/student-app-sidebar";
   import { StudentTopBar } from "@/components/student/student-top-bar";
   import { StudentShellSidebarController } from "./student-shell-client-island";
   // ... export type StudentShellProps unchanged
   export function StudentShell({ organizationName, userDisplayName, shareableId, email, avatarUrl, gradeLabel, entitlement, children }: StudentShellProps) {
     return (
       <PaywallProvider>
         <StudentShellSidebarController
           topBar={<StudentTopBar organizationName={organizationName} userDisplayName={userDisplayName} shareableId={shareableId} />}
           sidebar={<StudentAppSidebar user={{ name: userDisplayName, email, avatar: avatarUrl }} gradeLabel={gradeLabel} entitlement={entitlement} />}
         >
           {children}
         </StudentShellSidebarController>
       </PaywallProvider>
     );
   }
   ```

> **Caveat:** `<PaywallProvider>` is `"use client"` (it's React context). Keeping it at this level is fine, but it forces its descendant tree to be client-rendered through the provider. **The optimization here is removing the explicit `"use client"` from `student-shell.tsx`** so consumers (the layout) treat it as a server component for analysis purposes. Children passed in remain server-rendered as long as they themselves don't import the shell's client-only pieces.

> **Important sanity check:** confirm `<StudentAppSidebar>` and `<StudentTopBar>` work correctly when their parent is a server component. Both are `"use client"` and read context (`useSidebar`). They must be **descendants** of `<SidebarProvider>` at runtime (the controller). The composition above puts them as React-children of the controller, which renders them inside `<SidebarProvider>` — works.

- **Verify:** every student route still renders identically. `/student/practice/<testId>` still hides sidebar by default. Doubt chat fills viewport. Inspect React DevTools to confirm "Server Component" badge on `student-shell` and `student-layout`.
- **Risk mitigation:** push to a preview branch, click through every student route before merging.

### 6.2 Replace `SegmentPageTransition` with CSS-only (D2)

- [app/student/template.tsx](app/student/template.tsx) currently mounts framer-motion on every nav.
- Two options:
  - **(a) Delete the template.** No transition between routes. Acceptable trade-off; instant feel is preferred over fade.
  - **(b) Replace with CSS-only.** Edit [src/components/motion/segment-page-transition.tsx](src/components/motion/segment-page-transition.tsx):
    ```tsx
    import type { ReactNode } from "react";
    import { cn } from "@/lib/utils";
    export function SegmentPageTransition({ children, className }: { children: ReactNode; className?: string }) {
      return <div className={cn("min-h-0 min-w-0 w-full max-w-none segment-enter", className)}>{children}</div>;
    }
    ```
    Add to globals.css:
    ```css
    @keyframes segment-enter { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    .segment-enter { animation: segment-enter .22s cubic-bezier(.25,.1,.25,1) both; }
    @media (prefers-reduced-motion: reduce) { .segment-enter { animation: none; } }
    ```
- Same change for `app/parent/template.tsx`.
- **Verify:** in-segment navigation (e.g., dashboard → practice) still has a soft fade, no hydration of motion library on every nav.

### 6.3 Slim the root `Providers` (D5)

- [src/components/providers.tsx](src/components/providers.tsx).
- `Toaster` only fires when `toast()` is called. Keeping it at root is fine (it's small).
- `TooltipProvider` is fine at root.
- `ThemeProvider` is required for `next-themes` to inject the no-flash script — keep at root.
- Concrete optimization: confirm `Toaster` is only mounted in routes where `toast()` is invoked. If only authenticated routes use it, move from root to `app/student/layout.tsx` and `app/parent/layout.tsx` and `app/teacher/layout.tsx`. Marketing/legal/auth probably never `toast()`.
- **Audit step:** `grep -rn "toast(" app/ src/ --include="*.tsx" | grep -v sonner | grep -v "/* "` — if all hits are under `student/`, `parent/`, or `teacher/`, move Toaster.
- Keep this change conservative; don't remove things actually needed.

### 6.4 Make sidebar nav active-state work via prop, not `usePathname` (D8)

- [src/components/student/student-nav-main.tsx](src/components/student/student-nav-main.tsx) (line 51) and [src/components/student/student-nav-user.tsx](src/components/student/student-nav-user.tsx) — but `student-nav-user` only uses `useRouter` for sign-out and dropdown; that's interactive. Leave it client.
- For `student-nav-main`: receive `pathname` as prop from `student-shell.tsx` (server) which gets it via Next 16's server `headers()`-based path access. **But** Next.js does not expose pathname to RSC reliably without middleware passing it. Easiest:
  - Read `pathname` in `<StudentShellSidebarController>` (already client) and pass it to `<StudentAppSidebar>` as a prop. `<StudentAppSidebar>` is currently `"use client"` because of `useSidebar()` — keep it client. Its children `<StudentNavMain>` then becomes a presentational component that takes `pathname` as a prop. Net result: still client, but no second `usePathname` call. Marginal win.
- Skip if low priority.

### 6.5 `SubscriptionBanner` server-friendly (D9)

- [src/components/student/subscription/subscription-banner.tsx](src/components/student/subscription/subscription-banner.tsx) only uses `usePathname` to compute `immersiveShell`. The banner is rendered in `app/student/layout.tsx` line 40.
- Pass `pathname` from layout (which is a server component, but Next doesn't surface pathname) — this is messy. Alternative: pass `immersiveShell: boolean` from layout if computable from layout's `params`, or move banner inside the controller (which has pathname). Recommended: move `<SubscriptionBanner>` inside `<StudentShellSidebarController>` (already client) so it gets `pathname` for free without a second hook. Or keep as-is — banner is only rendered if entitlement requires it, which is rare.

### 6.6 Reports table virtualization (K1)

- [src/components/student/student-reports-view.tsx:685-720](src/components/student/student-reports-view.tsx).
- Install: `pnpm add @tanstack/react-virtual`.
- Wrap the `<table>` body with `useVirtualizer({ count: filteredSorted.length, estimateSize: () => 48, overscan: 8 })`. Render only visible rows.
- **Verify:** scroll a long reports list (>100 rows). Frame rate stays at 60 fps. DOM contains <50 `<tr>` at any time.
- **Risk:** semantic HTML — `<table>` virtualization is awkward. Consider switching to a CSS Grid or `<div role="table">` representation, or use Tanstack Virtual's "fixed-height row" pattern with absolute positioning inside the tbody. Test sortability + filtering with virtualization on.

### 6.7 Performance view filter state via URL (K2, partial)

- [src/components/student/student-performance-view.tsx:332-380](src/components/student/student-performance-view.tsx) has 6+ useState filters.
- Convert filters to `useSearchParams` reads + `router.replace(?status=...)` writes. Filter state survives reload, deep-link, sharing. State sync is server-driven. (This is a multi-day refactor — defer to a follow-up issue if too large.)
- For now, the smaller win: wrap the heavy matrix derivations in `useMemo` keyed on the actual filters used.

> **Commit:** `perf(6): server-render student shell + CSS template transition`. Click-through every authenticated route. Lighthouse mobile on `/student/dashboard`.

---

## Phase 7 — TTFB / Data Fetching [P0, ~3h, medium risk]

> Items G1, G2, G3, G4, G5, G6, G7, G8, G11, G12, G13.

### 7.1 Skip middleware for static-feeling routes (G2)

- Edit [proxy.ts](proxy.ts) matcher:
  ```ts
  export const config = {
    matcher: [
      "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|manifest.webmanifest|opengraph-image|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|xml|txt|json|mp4|webm)$).*)",
    ],
  };
  ```
- **Verify:** request `/manifest.webmanifest`, `/robots.txt`, etc. — DevTools Server-Timing header confirms middleware bypassed.

### 7.2 Stop calling `getUser()` in middleware (G1)

- Currently [src/lib/supabase/session.ts:34](src/lib/supabase/session.ts) calls `await supabase.auth.getUser()` on every request — a network round-trip to Supabase Auth.
- Goal: middleware should just **refresh** cookies (rotate access/refresh tokens if needed) without validating against Supabase Auth. The Supabase SSR helper requires `getUser()` for token rotation, but you can use `getSession()` which is cookie-only:
  ```ts
  // src/lib/supabase/session.ts
  // ... unchanged setup ...
  await supabase.auth.getSession(); // local cookie read; no network unless refresh needed
  return supabaseResponse;
  ```
- **Caveat:** if Supabase recommends `getUser()` for security (some posts argue it's the only call that revalidates the JWT), keep `getUser()` but minimize per-request impact:
  - Only run in middleware when the path is an authenticated route (skip for `/`, `/login`, `/signup/*`, `/legal/*`):
    ```ts
    // proxy.ts
    export async function proxy(request: NextRequest) {
      const url = request.nextUrl.pathname;
      const isPublic = url === "/" || url.startsWith("/login") || url.startsWith("/signup") || url.startsWith("/legal") || url.startsWith("/auth/");
      return await updateSession(request, { skipAuthCheck: isPublic });
    }
    ```
    Then `updateSession` skips the `getUser()` call when `skipAuthCheck` is true. This still rotates cookies but avoids the per-request Supabase call for unauthenticated landing/auth.
- **Verify:** logged-out → `/`: TTFB drops by ~100–300 ms (the Supabase round-trip). Logged-in → `/student/dashboard`: behavior unchanged.

### 7.3 Fix landing page double-getUser (G3)

- [app/page.tsx](app/page.tsx) calls `supabase.auth.getUser()` directly. Replace with `getServerUser()` (the cached helper):
  ```tsx
  import { getServerUser } from "@/lib/auth/get-server-user";
  // ...
  const user = await getServerUser();
  if (user) {
    const path = await resolvePostAuthPath();
    redirect(path);
  }
  ```
- `resolvePostAuthPath()` already uses `getServerUser()` and `getProfile()` (both cache-deduped), so net round-trips drop to 1 (auth) + 1 (profile).

### 7.4 Audit and fix server-action `getUser()` calls (G4)

- For every `app/**/actions.ts`, replace `supabase.auth.getUser()` with `getServerUser()` from `@/lib/auth/get-server-user`. The cache won't help across separate action invocations, but the helper is consistent and easy to swap later.
- **Better long-term:** create a `getActionContext()` helper that returns `{ user, profile, supabase }` — centralizes the auth+profile read for actions.

### 7.5 Parallelize practice session queries (G5)

- [app/student/practice/[testId]/page.tsx](app/student/practice/[testId]/page.tsx) reads `tests` → `subjects` → `questions` sequentially.
- Read tests first (we need its `subject_id` and status), then `Promise.all([subjects, questions])` for the remaining two.
- If status causes redirect, do that check inline before parallel fetch to avoid wasted work.
- Or, write a single SQL via a Supabase RPC `get_practice_test_with_questions(test_id uuid)` returning a JSON-aggregated payload — saves two extra round-trips. This is a separate migration; tag as follow-up.

### 7.6 Cache plan catalog and subjects list (G7, G12)

- For lookups that are immutable per-deploy or change rarely, wrap with `unstable_cache`:
  ```ts
  import { unstable_cache as cache, revalidateTag } from "next/cache";
  export const getCachedPlanCatalog = cache(
    async () => { /* DB query */ },
    ["plan-catalog"],
    { revalidate: 3600, tags: ["plan-catalog"] }
  );
  ```
- `revalidateTag("plan-catalog")` from any admin action that mutates plans.
- Apply to: plan catalog (already partially done per audit), subject directory, school directory.

### 7.7 Tune postgres pool (G8)

- Edit [src/db/index.ts](src/db/index.ts):
  ```ts
  const client = postgres(connectionString, {
    prepare: true,           // enable prepared statements (was false)
    max: 10,                 // pool size (Vercel functions are serverless; 10 is generous)
    idle_timeout: 30,        // seconds
    connect_timeout: 10,
  });
  ```
- **Verify:** dev `pnpm dev`, run a few authenticated requests. Watch logs for connection errors. Drizzle should still work with `prepare: true`. **If** any RLS-tied prepared-statement caching causes issues, revert `prepare: true` (Supabase's connection pooler historically had issues with it; verify against current Supabase docs and your `DATABASE_URL` — if it points to PgBouncer transaction-pool mode, `prepare: false` is correct).

### 7.8 Add `loading.tsx` to authenticated segments (L5)

- Create [app/student/loading.tsx](app/student/loading.tsx) with a lightweight skeleton that mirrors the shell.
- Same for `app/parent/loading.tsx`, `app/teacher/loading.tsx`.
- This lets Next stream the segment shell while async children load; small but consistent FCP improvement.

### 7.9 Audit `Set-Cookie` writes per request (G13)

- [src/lib/supabase/session.ts](src/lib/supabase/session.ts) lines 19–29 — currently always overwrite cookies even when `cookiesToSet` is empty.
- Skip the rebuild if `cookiesToSet.length === 0`:
  ```ts
  if (cookiesToSet.length > 0) {
    supabaseResponse = NextResponse.next({ request });
    for (const { name, value, options } of cookiesToSet) {
      supabaseResponse.cookies.set(name, value, options);
    }
  }
  ```
- This lets the CDN cache RSC responses for unauthenticated routes (Vercel only caches when `Set-Cookie` is absent).

### 7.10 Verify cached profile dedup actually fires (G11)

- Add a lightweight log in dev only inside `getCachedAppProfileRow`:
  ```ts
  if (process.env.NODE_ENV !== "production") console.log("[cached-profile] fetching", user.id);
  ```
- Confirm only one fetch per request even when both `app/student/layout.tsx` and `app/student/dashboard/page.tsx` call it. Remove the log once verified.

> **Commit:** `perf(7): TTFB — middleware skip + cached helpers + db pool`

---

## Phase 8 — Sentry + Third-Party [P1, ~1h, low risk]

> Items H1, H2, H3, H4, H5, H6.

### 8.1 Lower Sentry sample rates and console capture (H1, H2)

- [sentry.client.config.ts](sentry.client.config.ts), [sentry.server.config.ts](sentry.server.config.ts), [sentry.edge.config.ts](sentry.edge.config.ts) — change `consoleLoggingIntegration` levels from `["log", "warn", "error"]` to `["error"]`. `console.log` flooding Sentry is rarely useful and is paid ingest.
- Lower dev `tracesSampleRate` defaults from `0.2` → `0.05`. Production `0.02` is fine.
- **Verify:** Sentry dashboard ingest rate drops; only errors are captured. Latency from instrumentation reduced.

### 8.2 Disable Sentry session replay on slow routes (H3)

- Set `replaysOnErrorSampleRate: 0.05` (was 0.1). If product doesn't actively use replay, set to 0.
- Replay SDK is roughly 70 KB; lazy-load it only on routes prone to errors (e.g., practice session) by gating `Sentry.init` integrations conditionally — not a small change. Defer if low value.

### 8.3 Defer Sentry init past LCP (H4)

- [sentry.client.config.ts](sentry.client.config.ts) currently runs `Sentry.init` synchronously at import time. Wrap:
  ```ts
  if (typeof window !== "undefined") {
    const init = () => { /* existing Sentry.init call */ };
    if ("requestIdleCallback" in window) (window as any).requestIdleCallback(init, { timeout: 2000 });
    else setTimeout(init, 800);
  }
  ```
- **Caveat:** errors in the first ~1 s of app boot won't be captured. For most apps, this is an acceptable trade.
- **Verify:** LCP improves on slow-4G. Errors thrown after first paint still reported.

### 8.4 Add `dns-prefetch` for Razorpay (H6)

- For [app/student/subscription/page.tsx](app/student/subscription/page.tsx) and [app/parent/(portal)/subscription/page.tsx](app/parent/(portal)/subscription/page.tsx), inject:
  ```tsx
  import Link from "next/link";
  // inside the page component (or use Next's Metadata `other` field)
  export const metadata: Metadata = {
    other: {
      "link:dns-prefetch:checkout-razorpay": "https://checkout.razorpay.com",
      "link:preconnect:checkout-razorpay": "https://checkout.razorpay.com",
    },
  };
  ```
  (Or add `<link rel="preconnect" href="https://checkout.razorpay.com" />` directly via [Head], if the metadata approach is fiddly.)

> **Commit:** `perf(8): trim sentry + add razorpay preconnect`

---

## Phase 9 — Long-tail Items [P2/P3, ~2h, low risk]

> Items A4, A5, B-mop, C7, C8, C10, C11, C12, F11, I1, I2, I3, I4, I5, K3, L3, L4, L6, L7, L8.

### 9.1 Audit `tw-animate-css` usage (I1)

- Run `grep -rn "animate-" src/ app/ --include="*.tsx" | sort -u`. Every utility class name produced.
- Cross-reference against `tw-animate-css` docs to identify which classes are actually used.
- If only 2–5 utilities are used (`animate-spin`, `animate-pulse` are core Tailwind, not from the package), remove `tw-animate-css` import from globals.css and uninstall.
- **Verify:** every animation in the app still works.

### 9.2 Audit `shadcn/tailwind.css` (I2)

- Open the file from `node_modules/shadcn/tailwind.css`. Check what utilities it provides beyond stock Tailwind. Most of shadcn's CSS is component-level — likely we can drop the global import.
- **Verify:** all UI components still styled correctly after removal.

### 9.3 Recharts dynamic per-page (C8)

- For each Recharts consumer, wrap import:
  ```tsx
  const SubjectTopicRadarChart = dynamic(
    () => import("@/components/charts/subject-topic-radar-chart").then(m => ({ default: m.SubjectTopicRadarChart })),
    { ssr: false, loading: () => <div className="h-[220px]" /> }
  );
  ```
- Apply to:
  - [src/components/student/student-dashboard-view.tsx](src/components/student/student-dashboard-view.tsx) — already dynamic for analytics; check radar chart import
  - [src/components/blocks/feature-performance-radial.tsx](src/components/blocks/feature-performance-radial.tsx) — landing-page consumer; verify it's only imported by `Features` (server component) — Recharts inside should be in a `"use client"` boundary already. Wrap that boundary with `dynamic(ssr:false)`.
- **Verify:** dashboard charts still render. Landing radial loads on scroll.

### 9.4 Confirm `@react-pdf/renderer` server-only (C7)

- `grep -rn "@react-pdf/renderer" app/ src/`. Confirm only `app/api/student/reports/[testId]/pdf/route.tsx`. If so, `serverExternalPackages` (Phase 4) handles it.

### 9.5 Tiptap chunk slimming (C11)

- [src/components/student/practice/practice-rich-answer-editor.tsx](src/components/student/practice/practice-rich-answer-editor.tsx) line 3 — list which extensions are actually used in the editor's behavior. Each unused starter-kit node (`Codeblock`, `Blockquote`, `BulletList`, etc.) bloats the chunk.
- `StarterKit.configure({ codeBlock: false, blockquote: false, /* etc. */ })` to disable unused.
- **Verify:** editor still types, formats (link, table, super/subscript, underline) correctly.

### 9.6 Realtime usage isolation (C10)

- [src/components/student/practice/practice-grading-progress-view.tsx:151](src/components/student/practice/practice-grading-progress-view.tsx) uses `.channel()`. Confirm this file is dynamically imported from its consumer page (`app/student/practice/[testId]/grading/page.tsx`). If not, wrap:
  ```tsx
  const PracticeGradingProgressView = dynamic(
    () => import("@/components/student/practice/practice-grading-progress-view").then(m => ({ default: m.PracticeGradingProgressView })),
    { ssr: false }
  );
  ```
- **Verify:** grading screen still updates as the test grades.

### 9.7 SVG sprite for inline icons (I4)

- [globals.css:185-194](app/globals.css) — practice-matrix check glyphs as inline data-URLs. Move to a `public/sprites/checks.svg` with `<symbol id="check">`/`<symbol id="indeterminate">`. Reference via `background-image: url("/sprites/checks.svg#check")` if needed, or inline once and reuse via `<svg><use href="..."/>`.
- Not load-critical — defer if time-poor.

### 9.8 Notifications + assignments virtualization (K3)

- [app/student/notifications/page.tsx](app/student/notifications/page.tsx) — same pattern as 6.6 with Tanstack Virtual.
- [app/student/assignments/page.tsx](app/student/assignments/page.tsx) — same.

### 9.9 Add `error.tsx`/`not-found.tsx` boundaries (L6)

- Create lightweight `app/(auth)/error.tsx`, `app/student/error.tsx`, `app/parent/error.tsx`, `app/error.tsx` (root). Each renders a friendly message and a Try-Again button.

### 9.10 Wire `scripts/perf-check.mjs` into CI (L4)

- Open the file (already exists per [package.json:20](package.json:20)). Document what it measures. Add to `.github/workflows/*` if there's CI; otherwise note for a future task.

> **Commit:** `perf(9): long-tail (recharts dynamic, tiptap slim, virtualization)`

---

## Phase 10 — Final Polish + Hardening [P2, ~2h]

> Items B-residual, F6, I5, J4, L2 (residual).

### 10.1 Nonce-based CSP (F6, I5) — separate ticket recommended

- Migrating `'unsafe-inline'` out of `script-src` and `style-src` is a real project (Tailwind v4 inline-style limitations + Next inline scripts). File a follow-up ticket; do not block the perf push on it.

### 10.2 Image blur placeholders (J4)

- Add `placeholder="blur"` + `blurDataURL` to LCP-class images. Generate via [plaiceholder](https://github.com/joe-bell/plaiceholder) at build time.

### 10.3 web-vitals → Vercel Analytics (L2 enhancement)

- If Vercel Analytics is enabled, swap the Sentry capture in `web-vitals.ts` for `@vercel/analytics`'s `track()`. Cleaner dashboard.

---

## Cross-Phase Verification Matrix

After each phase, run:

| Check | Command |
|---|---|
| Type-check | `pnpm exec tsc --noEmit` |
| Lint | `pnpm lint` |
| Tests | `pnpm test` |
| Build | `pnpm build` |
| Dev smoke | `pnpm dev` and click through golden paths |
| Bundle | `pnpm analyze` and compare with previous treemap |
| Lighthouse | Mobile slow-4G + 4× CPU on `/`, `/login`, `/student/dashboard` |
| Production preview | `vercel deploy --prebuilt` against a preview env |

**Specific manual paths to click after each phase**:

1. `/` loads, all sections render, footer visible
2. `/login` page loads in dark mode (auth-studio class)
3. Login with a known test student → lands on `/student/dashboard`
4. Click sidebar → Practice → topic picker → start a test → answer one question → submit
5. Open `/student/doubt-chat` → ask a question → assistant streams reply
6. Click theme toggle in landing → flips dark/light without flash
7. `/student/subscription` → click upgrade → Razorpay modal opens
8. Log out → redirects to `/`
9. `/legal/privacy` renders without console errors
10. Mobile viewport (360px wide) — landing nav opens sheet, no horizontal scroll

If ANY of these breaks, **don't proceed**. `git revert` the offending commit and diagnose.

---

## Rollback Strategy

- Each phase is a single commit. `git revert <sha>` is a one-line undo.
- For asset deletions (Phase 2.1, 2.2): file is in git history; `git checkout HEAD~ -- public/marketing/subjects.gif` to restore.
- For dependency removals (Phase 1, Phase 3): `pnpm add <pkg>@<version>` from package.json history.
- Database / migration changes: NONE in this plan. The `entitlements` RPC tweak (G6) is read-only, no migration.
- Middleware changes (Phase 7.1, 7.2): if the matcher misses a path that needs auth, users see public content briefly. Test logged-out access to every authenticated route after.

---

## Estimated Total Wins (target)

| Metric | Before | Target | Source |
|---|---|---|---|
| Landing page transferred bytes (no cache) | ~14 MB | <1 MB | Phase 2.1 alone |
| Landing JS bytes | ~1.2 MB | ~350 KB | Phase 1 + 3 + 5 |
| Authenticated route JS (first nav) | ~1 MB | ~600 KB | Phase 6 + 9 |
| TTFB (logged-out landing) | ~250 ms | ~80 ms | Phase 7.1 + 7.2 |
| TTFB (logged-in dashboard) | ~400 ms | ~200 ms | Phase 7.4 + 7.5 + 7.7 |
| LCP (mobile slow-4G, landing) | ~5 s | ~1.8 s | Phase 2 + 5 |
| INP (dashboard) | ~250 ms | <100 ms | Phase 6.1 + 6.6 |

Numbers are estimates pre-measurement; Phase 0 establishes the actual baseline.

---

## Order of Operations Cheatsheet

```
Phase 0  (instrumentation)
   └─→ Phase 1 (dead deps)
        └─→ Phase 2 (assets)
             └─→ Phase 3 (motion lib)
                  └─→ Phase 4 (next.config)
                       └─→ Phase 5 (landing tree)
                            └─→ Phase 6 (auth shell)
                                 └─→ Phase 7 (TTFB)
                                      └─→ Phase 8 (sentry/third-party)
                                           └─→ Phase 9 (long-tail)
                                                └─→ Phase 10 (polish)
```

Each arrow = "verify everything works, commit, then proceed."

---

## Per-Item Cross-Reference

| Audit ID | Phase | Section |
|---|---|---|
| A1 (subjects.gif) | 2 | 2.1 |
| A2 (hero-dashboard.png) | 2 | 2.2 |
| A3 (auth-fractal-glass) | 2 | 2.3 |
| A4 (logo as favicon) | 2 | 2.8 |
| A5 (Unsplash avatars) | 2 / 9 | 2.6 / 9.6 |
| A6 (PWA/OG) | 2 | 2.8 |
| B1 (Geist weights) | 2 | 2.4 |
| B2 (display:swap) | 2 | 2.4 |
| B3 (--font-heading) | 2 | 2.5 |
| C1 (motion vs framer-motion) | 3 | 3.2–3.3 |
| C2 (three.js) | 5 | 5.1 |
| C3 (react-icons/fa) | 1 | 1.3 |
| C4 (react-icons/si) | 1 | 1.4 |
| C5 (radix-ui umbrella) | 1 | 1.1 |
| C6 (react-katex) | 1 | 1.2 |
| C7 (@react-pdf/renderer) | 4 / 9 | 4 / 9.4 |
| C8 (recharts dynamic) | 9 | 9.3 |
| C9 (optimizePackageImports) | 4 | 4 |
| C10 (realtime) | 9 | 9.6 |
| C11 (tiptap) | 9 | 9.5 |
| C12 (date-fns) | 4 | 4 |
| D1 (StudentShell client) | 6 | 6.1 |
| D2 (template) | 6 | 6.2 |
| D3 (HomeMarketingShell) | 5 | 5.7 |
| D4 (mega client components) | 6 / 9 | 6.6 / 9.5 |
| D5 (Providers) | 6 | 6.3 |
| D6, D7 (mounted guards/sheet) | 5 | 5.5–5.6 |
| D8 (sidebar nav) | 6 | 6.4 |
| D9 (SubscriptionBanner) | 6 | 6.5 |
| D10 (reviews rotator) | 9 | (CSS-only; covered by general principle) |
| E1 (MotionPageEnter) | 3 / 5 | 3.5 / 5.8 |
| E2 (DottedSurface) | 5 | 5.1 |
| E3 (marquees) | 5 | 5.2 |
| E4 (pricing whileInView) | 5 | 5.3 |
| E5 (cpu-architecture) | 5 | 5.4 |
| E6 (will-change overuse) | 5 | 5.2 (noted) |
| F1 (PPR) | 4 | 4.2 |
| F2 (serverExternalPackages) | 4 | 4 |
| F3 (optimizePackageImports) | 4 | 4 |
| F4 (Cache-Control) | 4 | 4 |
| F5 (CSP matcher) | 4 | 4 |
| F6 (nonce CSP) | 10 | 10.1 |
| F7 (compress) | 4 | 4 |
| F8 (reactStrictMode) | 4 | 4 |
| F9 (images formats) | 4 | 4 |
| F10 (ES2022) | 4 | 4.1 |
| F11 (.tsbuildinfo) | n/a | already in .gitignore (line 36) ✓ |
| G1 (middleware getUser) | 7 | 7.2 |
| G2 (matcher) | 7 | 7.1 |
| G3 (landing double-getUser) | 7 | 7.3 |
| G4 (server actions) | 7 | 7.4 |
| G5 (practice queries) | 7 | 7.5 |
| G6 (entitlements N+1) | 7 | (in 7.5/7.6 cluster — limit: USAGE_PERIOD_LOOKBACK already const) |
| G7 (unstable_cache) | 7 | 7.6 |
| G8 (postgres pool) | 7 | 7.7 |
| G9 (Suspense) | 7 | 7.8 |
| G10 (legal static) | 4 | 4.3 |
| G11 (cached profile dedup) | 7 | 7.10 |
| G12 (revalidate) | 7 | 7.6 |
| G13 (Set-Cookie) | 7 | 7.9 |
| H1, H2 (sentry trace/console) | 8 | 8.1 |
| H3 (replay) | 8 | 8.2 |
| H4 (sentry defer) | 8 | 8.3 |
| H5 (server external) | 4 | 4 |
| H6 (razorpay preconnect) | 8 | 8.4 |
| H7 (analytics) | n/a | future |
| I1 (tw-animate-css) | 9 | 9.1 |
| I2 (shadcn/tailwind.css) | 9 | 9.2 |
| I3 (type scale) | n/a | manual review only |
| I4 (data-URL svgs) | 9 | 9.7 |
| I5 (CSP unsafe-inline) | 10 | 10.1 |
| J1 (raw img) | 2 | 2.6 |
| J2 (Supabase avatars) | 2 / 9 | 2.6 |
| J3 (priority on LCP) | 2 | 2.7 |
| J4 (blur placeholders) | 10 | 10.2 |
| K1 (reports virtualization) | 6 | 6.6 |
| K2 (performance state in URL) | 6 | 6.7 |
| K3 (notifications) | 9 | 9.8 |
| L1 (bundle analyzer) | 0 | 0.1 |
| L2 (web-vitals) | 0 / 10 | 0.2 / 10.3 |
| L3 (vercel.json) | n/a | review only |
| L4 (perf-check.mjs) | 9 | 9.10 |
| L5 (loading.tsx) | 7 | 7.8 |
| L6 (error.tsx) | 9 | 9.9 |
| L7 (postgres extension) | 7 | covered in 7.7 |
| L8 (date-fns locales) | n/a | grep returned no locale imports |

---

## Open Questions Before Execution

1. **Motion lib direction** — confirm we standardize on `motion` (newer) vs `framer-motion` (older name, same code). Default: `motion`.
2. **Theme toggle UX** — is it acceptable for the landing toggle to render as a non-interactive placeholder during the first ~50 ms before hydration? (Removing the mounted-guard requires this concession.)
3. **Sentry replay** — keep `replaysOnErrorSampleRate: 0.1` or drop to 0? Depends on whether product team uses replays.
4. **Reports table virtualization** — confirm UX expectation: the current behavior renders all rows (good for Ctrl+F search). Virtualization disables Ctrl+F. Consider a "show all" toggle.
5. **Landing page client-vs-server** — willing to remove the page-enter fade entirely (Phase 3.5 / 5.8) for measurable LCP gain?

Answer these in PR review or ticket comments before starting Phase 5/6.

---

*End of plan. Each phase is independently shippable; pause between phases to verify metrics and golden paths.*
