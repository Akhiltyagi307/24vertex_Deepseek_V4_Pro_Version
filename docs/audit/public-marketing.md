# Public / Marketing / Legal — Audit Detail

**Snapshot:** 2026-05-17 | **Commit:** `5e5c58f` | **Scope:** `app/page.tsx`, `app/legal/**`, `app/manifest.ts`, `app/opengraph-image.tsx`, root marketing assets
**Overall: 72 / 100 → target 100 (gap = 28)**

> Static, unauthenticated surface. Code quality is high but the score is pulled down by `force-dynamic` on the root layout (kills SSG), missing sitemap/robots/JSON-LD, and missing error/loading scaffolding on the legal subtree.

## Score Breakdown

| Dimension | Current | Target | Gap |
|---|---:|---:|---:|
| Security | 88 | 100 | 12 |
| Structure | 89 | 100 | 11 |
| Performance | 75 | 100 | 25 |
| A11y | 80 | 100 | 20 |
| SEO / Meta | 60 | 100 | 40 |
| Errors + Loading | 65 | 100 | 35 |
| Observability | 85 | 100 | 15 |
| Tests | 30 | 100 | 70 |
| **Overall** | **72** | **100** | **28** |

Auth/AuthZ and Validation are `n/a` for this surface (no auth, no input forms).

## Path to 100 (ordered checklist)

1. [ ] Drop `dynamic = 'force-dynamic'` from root layout; split a static-friendly layout for `/` and `/legal/*` (+20 Performance)
2. [ ] Add `app/sitemap.ts` listing `/`, `/legal/*` (+15 SEO)
3. [ ] Add `app/robots.ts` disallowing `/admin`, `/api`, portals (+5 SEO)
4. [ ] Add `Organization` + `WebSite` JSON-LD on `app/page.tsx` (+5 SEO)
5. [ ] Add `alternates.canonical` to public-page metadata (+5 SEO)
6. [ ] Add `app/loading.tsx` and `app/legal/loading.tsx` (+15 Errors+Loading)
7. [ ] Add `app/legal/error.tsx` (+10 Errors+Loading)
8. [ ] Add `app/not-found.tsx` content beyond the default (root already exists; verify quality) (+10 Errors+Loading)
9. [ ] Tighten CSP `img-src` from `https:` → explicit allowlist (+5 Security)
10. [ ] Drop CSP `'unsafe-inline'` script-src (once legacy support not required) (+4 Security)
11. [ ] Add COOP/COEP/CORP headers (+3 Security)
12. [ ] Run axe sweep on `/` and each `/legal/*` page (+15 A11y)
13. [ ] Confirm keyboard nav across hero / pricing / footer (+5 A11y)
14. [ ] Add Playwright smoke for `/` and each `/legal/*` (+30 Tests)
15. [ ] Add Lighthouse CI check on landing (+30 Tests + 10 Performance)
16. [ ] Add web-vitals tag for `route=public/landing` (+10 Observability)

---

## Per-Dimension Deductions and Fixes

### Security — 88 / 100

**D1. CSP `img-src` includes the broad `https:` (−5)**
- Where: [src/lib/security/csp.ts:54](../../src/lib/security/csp.ts)
- Allows any HTTPS host as an image source. Enables hot-linking and exfiltration via image-as-beacon.
- **Fix:** Tighten to explicit allowlist: `'self' data: blob: https://<supabase-host>.supabase.co https://images.unsplash.com`. If marketing later adds a CDN, add it explicitly.

**D2. CSP `script-src 'unsafe-inline'` (−4, cross-cutting)**
- Where: same file, line 54. Modern browsers ignore it because of `'strict-dynamic'`; legacy browsers (Safari ≤15.4, older Chromium-on-Android) fall back to inline → XSS blast radius widens if any HTML sink ever lands.
- **Fix:** Drop `'unsafe-inline'` once you no longer need IE/Safari-15.

**D3. COOP / COEP / CORP headers missing (−3)**
- Where: [next.config.ts:88](../../next.config.ts)
- **Fix:** Add `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Resource-Policy: same-origin`. COEP can stay off (it interferes with cross-origin images).

### Structure — 89 / 100

**D4. Marketing page sits at `app/page.tsx`; not in a dedicated route group (−5)**
- Mixing the public landing with portal routing at the same `app/` root makes it harder to apply a static-friendly layout.
- **Fix:** Create `app/(public)/layout.tsx` + move `page.tsx` and `legal/` under it. The public layout can be static; root layout stays per-request for portal subtrees.

**D5. `app/legal/**` files lack a shared layout (−3)**
- Each legal page renders its own document chrome.
- **Fix:** Add `app/legal/layout.tsx` with consistent header (logo, "Back to home"), table of contents sidebar, last-updated date.

**D6. `app/opengraph-image.tsx` and `app/apple-icon.png` are mixed at root (−3)**
- Convention is to keep brand assets under `app/(public)/`.
- **Fix:** Move once the (public) group lands.

### Performance — 75 / 100

**D7. Root layout sets `dynamic = 'force-dynamic'` (−15)**
- Where: [app/layout.tsx:68](../../app/layout.tsx)
- Forces every page (including `/` and `/legal/*`) to render per-request to attach a CSP nonce. Kills SSG; punishes TTFB on the marketing landing.
- **Fix:** Move portal-shell + CSP nonce into a per-portal layout. Build `app/(public)/layout.tsx` as a static layout with a static CSP (no nonce). The landing page becomes a fully static export served from Vercel's edge.

**D8. Three.js used in `dotted-surface` (−5, mitigated)**
- Where: [src/components/ui/dotted-surface.tsx:5](../../src/components/ui/dotted-surface.tsx) is the static import; [src/components/marketing/dotted-surface-lazy.tsx:15](../../src/components/marketing/dotted-surface-lazy.tsx) lazy-loads it via `next/dynamic`. OK on the wire, but the lazy wrapper triggers on view. Confirm the chunk is gzipped < 100 KB.
- **Fix:** Profile in `pnpm analyze` and confirm three.js stays under 90 KB gzipped first-paint impact.

**D9. No `next/image` for the landing hero (verify) (−5)**
- Scan `app/page.tsx` for raw `<img>` and replace with `next/image`.

### A11y — 80 / 100

**D10. Landing animations (`dotted-surface`, `motion`) lack `prefers-reduced-motion` guards (−5)**
- Confirm marketing animations honor `prefers-reduced-motion: reduce`.
- **Fix:** Wrap `motion.*` props with `useReducedMotion()` from `motion`.

**D11. No axe sweep on `/` and `/legal/*` (−10)**
- **Fix:** Add `tests/e2e/public-a11y.spec.ts` running axe across all public URLs.

**D12. Keyboard tab order on landing not verified (−5)**
- Especially with `dotted-surface` interactive elements. Manually walk the tab order; ensure focus indicators visible.

### SEO / Meta — 60 / 100

**D13. No `app/sitemap.ts` (−15)**
- Search engines crawl what they discover; no sitemap means coverage is best-effort.
- **Fix:** Add `app/sitemap.ts`:
  ```ts
  import type { MetadataRoute } from 'next';
  export default function sitemap(): MetadataRoute.Sitemap {
    return [
      { url: 'https://app.24vertex.example.com/', lastModified: new Date(), changeFrequency: 'monthly', priority: 1 },
      { url: 'https://app.24vertex.example.com/legal/terms', lastModified: new Date(), changeFrequency: 'yearly', priority: 0.5 },
      // … one per legal page
    ];
  }
  ```

**D14. No `app/robots.ts` (−5)**
- Admin paths rely on the `X-Robots-Tag: noindex,nofollow` header set in [next.config.ts:109](../../next.config.ts). robots.txt is still the canonical place.
- **Fix:**
  ```ts
  export default function robots(): MetadataRoute.Robots {
    return {
      rules: [
        { userAgent: '*', allow: ['/', '/legal/'], disallow: ['/admin/', '/api/', '/student/', '/teacher/', '/parent/'] },
      ],
      sitemap: 'https://app.24vertex.example.com/sitemap.xml',
    };
  }
  ```

**D15. No JSON-LD on `app/page.tsx` (−5)**
- **Fix:** Add a single `<script type="application/ld+json">` with `Organization` (name, url, logo, contactPoint) and `WebSite` (with `potentialAction: SearchAction` if you have a search endpoint).

**D16. No `alternates.canonical` on public pages (−5)**
- Without canonicals, sharing `/?utm_source=foo` indexes duplicates.
- **Fix:** Set `alternates: { canonical: '/' }` in `app/page.tsx` and each legal page.

**D17. OG image good, but no Twitter card / specific images per legal page (−5)**
- Where: [app/opengraph-image.tsx](../../app/opengraph-image.tsx) is well-branded.
- **Fix:** Add `twitter: { card: 'summary_large_image' }` in root metadata; consider per-legal-page OG (uses same generator).

**D18. No `metadataBase` validation (−5)**
- Confirm `metadataBase` in `app/layout.tsx` resolves to the canonical production domain.

### Errors + Loading — 65 / 100

**D19. No `loading.tsx` at root (`/`) (−10)**
- The landing page navigates from the root layout; first paint has no skeleton.
- **Fix:** Add `app/loading.tsx` with a minimal hero skeleton.

**D20. No `loading.tsx` for `app/legal` (−5)**
- **Fix:** Add `app/legal/loading.tsx`.

**D21. No `error.tsx` for `app/legal` (−10)**
- A render error on a legal page falls back to root error.
- **Fix:** Add `app/legal/error.tsx` with a "page is having trouble loading" message + link home.

**D22. Root `app/not-found.tsx` exists but doesn't render portal-aware chrome (−10)**
- This is fine for `/` but bad for portal 404s. Per-portal `not-found.tsx` is tracked in each portal artifact.

### Observability — 85 / 100

**D23. web-vitals tag for public routes not differentiated (−5)**
- Public landing should have its own tag in Sentry so marketing performance regressions are visible separately from authenticated routes.
- **Fix:** In [src/lib/observability/web-vitals.ts](../../src/lib/observability/web-vitals.ts), tag `route=public/landing` and `route=legal/${slug}` so they appear in dedicated Sentry views.

**D24. No conversion / funnel events emitted (−5)**
- "CTA click → signup landed" is presumably valuable. Sentry isn't an analytics tool; consider a lightweight beacon to your own metrics endpoint (no third-party tracking).
- **Fix:** Define a small `trackPublicEvent(name, props)` helper that POSTs to `/api/internal/marketing-events` (with rate-limit). Or wire PostHog/Plausible if you've chosen one.

**D25. No Lighthouse / web-vitals CI check on the landing (−5)**
- **Fix:** Add a `.github/workflows/landing-lighthouse.yml` running Lighthouse CI on PRs touching `app/page.tsx`, `app/layout.tsx`, or `src/components/marketing/`.

### Tests — 30 / 100

**D26. No Playwright smoke for `/` (−15)**
- **Fix:** `tests/e2e/landing.spec.ts` — page loads, hero renders, CTA navigates to `/signup/role-picker`.

**D27. No Playwright smoke for `/legal/*` (−15)**
- **Fix:** Iterate over legal page slugs; assert each renders without console errors.

**D28. No visual regression on landing (−10)**
- **Fix:** Add a Playwright visual snapshot for the landing hero at desktop + mobile widths.

**D29. No accessibility test on landing (−15)**
- Same as D11 — counted once in A11y; tracked here as a test-shape gap.

**D30. No Lighthouse perf gate (−15)**
- Same as D25.

---

## Cross-Portal Dependencies

- **D2** (CSP `'unsafe-inline'`) → [src/lib/security/csp.ts](../../src/lib/security/csp.ts).
- **D3** (COOP/COEP/CORP) → [next.config.ts](../../next.config.ts).
- **D7** (root `force-dynamic`) → [app/layout.tsx](../../app/layout.tsx) — fixing this unlocks SSG for marketing AND removes a forced-dynamic cost for authenticated portals.
- **D15** (JSON-LD) — bumps the public score; cross-cited as helpful for portal `Organization` reuse.

## Estimated Effort to 100

| Bucket | Effort | Score lift |
|---|---|---:|
| Split static-friendly `(public)` layout + drop root `force-dynamic` | M (4 hr) | +20 Performance |
| `app/sitemap.ts` + `app/robots.ts` | XS (30 min) | +20 SEO |
| JSON-LD on landing | S (1 hr) | +5 SEO |
| `alternates.canonical` + twitter card + metadataBase | S (1 hr) | +10 SEO |
| `loading.tsx` for `/` and `/legal` | XS (30 min) | +15 Errors |
| `error.tsx` for `/legal` | XS (15 min) | +10 Errors |
| Tighten CSP `img-src` | XS (15 min) | +5 Security |
| Drop CSP `'unsafe-inline'` script-src | S (2 hr — needs verification) | +4 Security |
| COOP/CORP headers | XS (15 min) | +3 Security |
| `(public)` route group reshuffle | S (2 hr) | +5 Structure |
| Shared `legal/layout.tsx` | S (2 hr) | +3 Structure |
| `prefers-reduced-motion` honoring | S (1 hr) | +5 A11y |
| axe sweep + fixes | M (3 hr) | +10 A11y |
| Keyboard nav verification | S (1 hr) | +5 A11y |
| `next/image` for hero | S (1 hr) | +5 Performance |
| Profile three.js chunk | S (1 hr) | included in D8 |
| web-vitals public tag + funnel beacon | S (2 hr) | +10 Observability |
| Lighthouse CI on landing | S (3 hr) | +10 Performance + 15 Tests |
| Playwright `landing.spec.ts` + `legal-pages.spec.ts` + visual | M (4 hr) | +40 Tests |
| **Total** | **~30 hr** | **→ 100** |

> Single highest-leverage fix: D7 (split layout + drop `force-dynamic`). It unlocks SSG on marketing, reduces TTFB on the landing page from ~250 ms → < 50 ms at the edge, and removes per-request rendering cost on portal pages too (with the right scoping).
