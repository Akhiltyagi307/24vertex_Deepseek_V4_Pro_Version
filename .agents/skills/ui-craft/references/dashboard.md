# Dashboard Patterns

Data-heavy dashboards that match **Supabase Studio** density and polish — plus general dashboard craft.

> **Canonical spec:** [**design-v2.md**](./design-v2.md) §5 (shell), §8 (components), §11 (charts), §12 (loading). Tokens, exact CSS, and Tailwind extensions live there. This file summarizes **patterns** and defers numbers to design-v2.

---

## Layout Structure

A Studio-shaped app uses **topbar + sidebar + scrollable content** (design-v2 §5.3).

**Sidebar**
- Background `#181818` (`--background-sidebar`), **right border** `1px solid #2A2A2A` (or `--border-default` where equivalent).
- **Collapsed:** ~**56px** wide, icons only; **expanded:** **200–220px**, icon + label.
- Nav item: **32px** row height feel, **13px** text, muted → default foreground on hover; **active** surface step + **500** weight (§8.2).
- `aria-label="Main navigation"`, `aria-current="page"` on active route.
- `overscroll-behavior: contain` if the sidebar scrolls independently.

**Main content**
- Padding ~**24px**; filters/toolbar row; grid of **metrics → charts → tables** as needed.
- **Cards / panels:** `#252525` surface, **`1px` border** `#2E2E2E`, **8px** radius — elevation is **border + fill**, not drop shadows on dark cards (design-v2 §1, §8.3).

---

## Metric cards

Follow **§8.5** — do not invent a separate “hero metric” system with **700** weight numbers (design-v2 §21 caps dashboard weight at **600**).

- **Label:** **JetBrains Mono**, **11px**, **500**, **uppercase**, **`letter-spacing: 0.08em`**, color **`foreground-muted`**.
- **Value:** **24px**, **600**, **`foreground-default`**, `line-height` ~1.2.
- **Chart area:** bordered placeholder or Recharts styling per **§11** — green primary series `#3ECF8E`, grid/axis rules as specified.
- **Change / delta copy:** prefer **neutral** secondary text; if you encode direction with color, use **semantic** green/red sparingly and keep labels readable (avoid rainbow deltas).

---

## Chart type decision matrix

| Data story | Best chart | Why | Avoid |
|------------|------------|-----|--------|
| Trend over time | Area or line (Recharts) | Direction + volume | Vertical bar for time |
| Comparing categories | Horizontal bar | Readable labels | Rotated vertical labels |
| Small discrete set | Vertical bar | Natural for 3–7 items | Too many bars (>8) |
| Part-of-whole | Donut sparingly | Center can show total | 3D pie |
| Inline trend in card | Sparkline | Contextual | Full chart crammed in card |
| Funnel / stages | Stacked or step bars | Drop-offs visible | Donut funnel |

**Styling:** use the **§11** palette order (green, blue, amber, purple, …) and Recharts CSS hooks — no more than **~4** distinct hues per chart; use **opacity** for additional series (design-v2 §21).

---

## Data tables

Studio **Table Editor** pattern (**§8.7**):

- **Font:** **JetBrains Mono**, **12px** body cells; **header row** **36px**, body **32px**.
- **Header:** **11px**, **500**, **`foreground-light`**; optional **green** icon for PK — not random rainbow badges.
- **Borders:** subtle column/row dividers per spec; **hover** row background step.
- **`NULL`:** **`foreground-faint`**; UUIDs muted/smaller as in §8.7.
- **Alignment:** text left, numbers right, compact actions center — keep **density** high (design-v2 §1 “density first”).

**Row chrome:** tiny status **dots** or proportion bars are fine; avoid noisy pill badges on every cell unless they match **§8.4** badge rules.

---

## Filters & toolbar

- Prefer **ghost** / **default** buttons (§8.6) — not solid primary for every filter.
- Active filter: surface step + **strong** border or brand-adjacent treatment; **date range** can be slightly more prominent.
- **Reset:** text link when filters active — same idea as before, styled with Studio tokens.

---

## Content density

- **Default UI text 13px**; labels can go **10–11px** where appropriate (design-v2 §1).
- Metric + chart + table **above the fold** when possible for decision-making dashboards.
- Prefer **tight** card padding (**16px** standard, **20px** generous per §4) over landing-page whitespace.

---

## Loading & empty

- **Skeleton** shimmer and **spinner** colors per **§12** (green accent on track).
- Empty chart/metric states: **dashed border**, muted copy — **§11.5**, **§8.5** `.metric-chart-empty` pattern.
