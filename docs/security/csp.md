# Content Security Policy decisions

This page documents the per-directive choices in `src/lib/security/csp.ts`
and `next.config.ts`. Update when you flip a knob.

## `script-src` — `'unsafe-inline'` fallback

**Current state (production-recommended):**
`PRODUCTION_DROP_UNSAFE_INLINE_SCRIPT_FALLBACK=1` set in Vercel production.

**What this means:** the `'unsafe-inline'` keyword is removed from
`script-src` whenever `VERCEL_ENV === "production"` AND the env flag is `1`.

**Why this is safe:**
- The CSP also carries `'strict-dynamic'` + a per-request `nonce-...`.
- Per the CSP3 spec, when `'strict-dynamic'` is present, modern browsers
  ignore both the host allowlist AND `'unsafe-inline'`.
- This means dropping `'unsafe-inline'` changes **nothing** in evergreen
  Chrome, Firefox, Safari (≥15), Edge.
- The legacy clients that DO honor `'unsafe-inline'` (Safari <15, Chrome
  <70) lose the ability to run inline `<script>` tags. Our framework
  scripts are nonced and use external chunks; the only practical impact
  is third-party inline scripts (none currently installed).

**When to roll back:** unset
`PRODUCTION_DROP_UNSAFE_INLINE_SCRIPT_FALLBACK` in Vercel. The fallback
reappears in the next deploy. Reasons to roll back:
- a vendor library starts emitting un-nonced inline `<script>` and we
  haven't yet adapted (e.g. an analytics SDK we're forced to install
  inline);
- legacy-browser audience grows materially (e.g. a partnership with a
  region where Safari ≤14 has non-trivial share).

**Detection:** Sentry captures CSP-violation reports via the `/csp-report`
endpoint (not currently wired — TODO). Once wired, alert on the count of
`violated-directive: "script-src"` blocked-uri = `inline` events.

## `style-src` — `'unsafe-inline'`

**Kept (not flipped):** Radix, Sonner, Tailwind, and `next-themes` all
emit inline styles at runtime. The Trusted-Types audit (out of scope —
see `docs/security/trusted-types.md` if/when created) would also need to
hash or nonce these.

## `img-src` — explicit allowlist

The previous blanket `https:` was tightened to:
- `'self'`, `data:`, `blob:`
- Supabase storage origin (parsed from `NEXT_PUBLIC_SUPABASE_URL`)
- `https://images.unsplash.com` (marketing pages)

When adding a new image origin: update BOTH `src/lib/security/csp.ts`
(for the CSP) AND `next.config.ts#images.remotePatterns` (for the
next/image optimizer).

## `frame-src`

Allows `https://api.razorpay.com` and `https://checkout.razorpay.com`
(payment flow). No other third-party iframes are needed today.

## `frame-ancestors`

`'self'` only — clickjacking guard. Admin pages also carry
`X-Frame-Options: SAMEORIGIN` via `next.config.ts` for legacy-browser
parity.

## `require-trusted-types-for 'script'`

**Disabled** — re-enabling requires a per-library audit (Tiptap, MJML,
recharts, next-themes' inline pre-hydration script, Sentry replays all
assign raw strings to `innerHTML`/`createScript` sinks). The default
`trustedTypes.createPolicy` shim approach is documented in the audit
backlog.

## Cross-origin headers

| Header | Value | Reason |
|---|---|---|
| `Cross-Origin-Opener-Policy` | `same-origin` | Window isolation; default in 2024+ |
| `Cross-Origin-Resource-Policy` | `same-origin` | Block other origins from embedding |
| `Cross-Origin-Embedder-Policy` | not set | Would block Unsplash + Razorpay branding until they ship CORP |

If we ever want `Cross-Origin-Isolated` (for `SharedArrayBuffer`, etc.),
all third-party origins we embed need `Cross-Origin-Resource-Policy:
cross-origin`. Not currently a need.

## How to verify a CSP change

1. Run the app locally (`pnpm dev`).
2. Open a page in Chrome DevTools → Network → click the document → Headers
   pane → confirm `content-security-policy` shape matches expectation.
3. Open the page in a private window (no extensions) and watch the
   Console for `Refused to ...` CSP violations.
4. Push to a Vercel preview deploy and re-check.
5. The bundle-budget + lighthouse CI workflows fail-loud if a CSP change
   regresses the landing perf budget.
