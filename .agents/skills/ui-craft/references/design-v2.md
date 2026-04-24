# Supabase Design System — Complete Reference v2

> Reverse-engineered from Supabase Studio screenshots, the official design system docs, and the Supabase UI source. Covers every surface, state, and pattern. Use as a drop-in reference for any Supabase-styled interface — including EduAI.

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Color System](#2-color-system)
3. [Typography](#3-typography)
4. [Spacing & Sizing Tokens](#4-spacing--sizing-tokens)
5. [Layout & Breakpoints](#5-layout--breakpoints)
6. [Component States — Universal Rules](#6-component-states--universal-rules)
7. [Accessibility & Focus](#7-accessibility--focus)
8. [Component Specifications](#8-component-specifications)
9. [Form Components](#9-form-components)
10. [Code Editor & SQL Surface](#10-code-editor--sql-surface)
11. [Data Visualization & Charts](#11-data-visualization--charts)
12. [Loading, Skeleton & Progress](#12-loading-skeleton--progress)
13. [Modals, Sheets & Dialogs](#13-modals-sheets--dialogs)
14. [Toast & Notification System](#14-toast--notification-system)
15. [Dark vs Light Mode Deltas](#15-dark-vs-light-mode-deltas)
16. [Animation & Motion](#16-animation--motion)
17. [Icon System](#17-icon-system)
18. [CSS Variables — Full Reference](#18-css-variables--full-reference)
19. [Tailwind Configuration](#19-tailwind-configuration)
20. [EduAI-Specific Patterns](#20-eduai-specific-patterns)
21. [Do's and Don'ts](#21-dos-and-donts)

---

## 1. Design Philosophy

Supabase is a **developer-first, dark-mode-primary** design system. The aesthetic is borrowed from code editors and terminal UIs: dark surfaces, monospaced accents, high information density, and one electric-green brand color that signals success and interaction.

**Core principles:**
- **Borders over shadows.** Elevation is expressed with 1px borders and subtle background steps, never drop shadows on cards.
- **Color means something.** Every non-gray color carries semantic weight. Green = success/action. Amber = warning/environment. Red = destructive. Blue = informational.
- **Density first.** More data visible at once is better. Default type is 13px, labels can go to 10px.
- **Monospace for data.** All database values, UUIDs, code, and metric labels use a monospaced font.
- **Dark is canonical.** Light mode exists but is secondary. Design for dark first; adapt to light.

---

## 2. Color System

Supabase uses a **12-step Radix color scale** aliased to a "scale" token. In dark mode the scale resolves to Radix `slate`; in light mode to Radix `gray`. All component colors reference `scale-*` or semantic tokens — never raw hex values in components.

### 2.1 Brand Colors

| Role | Name | Hex | OKLCH |
|---|---|---|---|
| Primary brand | Supabase Green | `#3ECF8E` | `oklch(0.70 0.18 155)` |
| Brand hover | Deep Green | `#34B27B` | `oklch(0.63 0.16 155)` |
| Brand subtle bg | Green tint | `rgba(62,207,142,0.10)` | — |
| Brand muted | Dark green | `#1A7A4A` | — |

### 2.2 Dark Theme — Background Scale

| Token | Approx Hex | Notes |
|---|---|---|
| `bg-default` | `#1C1C1C` | Outermost page background |
| `bg-studio` | `#1E1E1E` | App shell |
| `bg-sidebar` | `#181818` | Sidebar, slightly deeper than shell |
| `bg-surface-75` | `#222222` | Subtle elevated surface |
| `bg-surface-100` | `#252525` | Standard card / panel |
| `bg-surface-200` | `#2C2C2C` | Elevated card, hovered row |
| `bg-surface-300` | `#333333` | Tooltip, popover |
| `bg-overlay` | `#1C1C1Ccc` | Modal backdrop (80% opacity) |

### 2.3 Border Colors (Dark)

| Token | Approx Hex | Usage |
|---|---|---|
| `border-muted` | `#252525` | Table row dividers, subtle separators |
| `border-default` | `#2E2E2E` | Default card, panel, input borders |
| `border-strong` | `#3D3D3D` | Active/hover borders, focus rings base |
| `border-overlay` | `#484848` | Dropdown, modal borders |

### 2.4 Text Colors (Dark)

| Token | Approx Hex | Usage |
|---|---|---|
| `foreground-default` | `#EDEDED` | Primary body, headings |
| `foreground-light` | `#A0A0A0` | Secondary text, descriptions |
| `foreground-muted` | `#6B6B6B` | Captions, placeholders, timestamps |
| `foreground-faint` | `#4B4B4B` | Disabled, ghost elements |
| `foreground-on-brand` | `#000000` | Text on green CTA buttons |

### 2.5 Semantic Status Colors

| State | Hex | RGBA subtle bg | Usage |
|---|---|---|---|
| Success / Brand | `#3ECF8E` | `rgba(62,207,142,0.10)` | CTAs, installed, success |
| Warning / Production | `#F5A524` | `rgba(245,165,36,0.12)` | Env badge, warning states |
| Alpha | `#E47400` | `rgba(228,116,0,0.12)` | Alpha release badge |
| Beta | `#D97706` | `rgba(217,119,6,0.10)` | Beta badge |
| Destructive | `#E55353` | `rgba(229,83,83,0.10)` | Delete, errors |
| Info | `#3B82F6` | `rgba(59,130,246,0.10)` | Info callouts |
| Official (neutral) | `#6B6B6B` | transparent | "OFFICIAL" badge |
| Advisors accent | `#F5A524` | — | Yellow dot on Advisors icon |

---

## 3. Typography

### 3.1 Font Families

| Role | Font | Fallback Stack |
|---|---|---|
| UI / Body | Custom sans (Circular-adjacent) | `ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif` |
| Code / Data | JetBrains Mono | `"JetBrains Mono", ui-monospace, "Cascadia Code", "Fira Code", Consolas, monospace` |

**Notes:**
- Supabase Studio uses a rounded, slightly-condensed sans-serif that sits between Inter and Circular Std. Inter is the closest free substitute.
- JetBrains Mono is used for all data values, SQL, metric labels, UUIDs, and inline code.
- **Never** mix body text and mono fonts in the same sentence unless the mono portion is a code value.

### 3.2 Type Scale

| Style | Size | Weight | Line Height | Letter Spacing | Font | Usage |
|---|---|---|---|---|---|---|
| Display | 36px | 700 | 1.15 | −0.02em | Sans | Marketing / hero headings |
| H1 | 24px | 600 | 1.25 | −0.015em | Sans | Page-level titles |
| H2 | 18px | 600 | 1.35 | −0.01em | Sans | Section headings |
| H3 | 15px | 600 | 1.4 | −0.005em | Sans | Card / sub-section titles |
| H4 | 13px | 600 | 1.5 | 0 | Sans | Small group labels |
| Body | 13px | 400 | 1.6 | 0 | Sans | Default UI copy |
| Body-sm | 12px | 400 | 1.5 | 0 | Sans | Descriptions, help text |
| Caption | 11px | 400 | 1.4 | 0 | Sans | Timestamps, secondary meta |
| Label-upper | 11px | 500 | 1.4 | **+0.08em** | Mono | Metric card titles, column headers |
| Code-inline | 12px | 400 | 1.6 | 0 | Mono | `inline code`, values |
| Code-block | 13px | 400 | 1.7 | 0 | Mono | SQL editor, code blocks |
| Numeric-hero | 24px | 600 | 1.2 | −0.02em | Sans | Stat values in metric cards |

### 3.3 Text Colour Usage Rules

- Headings and primary labels: `foreground-default` (`#EDEDED`)
- Body descriptions: `foreground-light` (`#A0A0A0`)
- Placeholders, captions: `foreground-muted` (`#6B6B6B`)
- Disabled content: `foreground-faint` (`#4B4B4B`)
- `NULL` database values: `foreground-faint`
- Uppercase tracking labels (e.g. "DATABASE REQUESTS"): `foreground-muted` + `letter-spacing: 0.08em` + `text-transform: uppercase` + mono font

---

## 4. Spacing & Sizing Tokens

Supabase uses an **8px base grid**. All spacing should be multiples of 4px minimum, preferably 8px.

### 4.1 Space Scale

| Name | px | Tailwind | Usage |
|---|---|---|---|
| space-1 | 4px | `p-1` / `gap-1` | Icon inner padding, tight gaps |
| space-2 | 8px | `p-2` / `gap-2` | Button inner padding (vertical), inline gaps |
| space-3 | 12px | `p-3` / `gap-3` | Form label-to-input spacing |
| space-4 | 16px | `p-4` / `gap-4` | Card inner padding (standard) |
| space-5 | 20px | `p-5` / `gap-5` | Card inner padding (generous) |
| space-6 | 24px | `p-6` / `gap-6` | Page section padding |
| space-8 | 32px | `p-8` / `gap-8` | Between major sections |
| space-12 | 48px | `p-12` | Page top padding |

### 4.2 Component Sizing

| Component | Height | Notes |
|---|---|---|
| Topbar | 48px | Fixed, no flex growth |
| Nav item (sidebar) | 32px | Icon + label row |
| Button (default) | 32px | `py-1.5 px-3` |
| Button (sm) | 28px | `py-1 px-2.5` |
| Button (lg) | 38px | `py-2 px-4` |
| Input (default) | 32px | Matches button height |
| Input (sm) | 28px | Compact form context |
| Table row | 32px | Data table |
| Table header row | 36px | Slightly taller |
| Badge / pill | 18–20px | Auto height from padding |
| Dropdown item | 28px | `py-1.5 px-2.5` |
| Sidebar (icon only) | — | 56px wide |
| Sidebar (expanded) | — | 200–220px wide |

### 4.3 Border Radius Scale

| Token | Value | Usage |
|---|---|---|
| `radius-xs` | 3px | Badges, pills, tiny chips |
| `radius-sm` | 4px | Tags, environment labels |
| `radius` | 6px | Buttons, inputs, dropdowns |
| `radius-md` | 8px | Cards, panels, modals |
| `radius-lg` | 12px | Large modals, drawers |
| `radius-full` | 9999px | Avatar circles, toggle thumbs |

---

## 5. Layout & Breakpoints

### 5.1 Breakpoints

Supabase Studio is primarily a desktop application. Responsive behaviour collapses and adapts the sidebar; the main content never goes below ~900px in a meaningful way.

| Name | Min-width | Behaviour |
|---|---|---|
| `sm` | 640px | Rarely targeted; sidebar still visible |
| `md` | 768px | Sidebar collapses to icon-only |
| `lg` | 1024px | Sidebar expands; standard layout |
| `xl` | 1280px | Content columns widen |
| `2xl` | 1536px | Max useful; beyond this whitespace grows |

### 5.2 Sidebar Responsive Behaviour

```
< 1024px  →  Sidebar collapses to 56px (icons only, no labels)
≥ 1024px  →  Sidebar expands to 200–220px (icons + labels)
< 768px   →  Sidebar hidden behind hamburger / drawer overlay
```

- On collapse: icon tooltips appear on hover to expose nav labels
- Active state indicator remains (background highlight, no left border)
- Bottom icons (theme toggle, user avatar) always visible regardless of collapse state

### 5.3 App Shell Structure

```
┌──────────────────────────────────────────────────────────┐
│  TOPBAR  ·  48px  ·  full width                         │
├──────────┬───────────────────────────────────────────────┤
│          │  CONTENT AREA                                 │
│ SIDEBAR  │  padding: 24px                                │
│ 56–220px │  max-width: none (fills viewport)            │
│          │  overflow-y: auto (independent scroll)        │
│          │                                               │
│          │  Inner grids: repeat(auto-fill, ...) or       │
│          │  explicit column counts per section           │
└──────────┴───────────────────────────────────────────────┘
```

### 5.4 Content Grid Patterns

| Pattern | CSS | Used for |
|---|---|---|
| 2-col | `grid-cols-2 gap-4` | Side-by-side panels |
| 3-col | `grid-cols-3 gap-4` | Tri-panel layouts |
| 4-col | `grid-cols-4 gap-4` | Metric cards row |
| 5-col (connect) | `repeat(5, 1fr)` with 1px gap | "Get connected" feature grid |
| Auto-fill cards | `repeat(auto-fill, minmax(280px, 1fr))` | Integration card grids |
| Full-bleed table | `w-full` no max-width | Table editor, SQL editor |

---

## 6. Component States — Universal Rules

Every interactive component must handle all six states. Here is the system-wide spec:

| State | Visual treatment |
|---|---|
| **Default** | As specified per component |
| **Hover** | Background lightens by one scale step; border becomes `border-strong` |
| **Focus** | `outline: 2px solid #3ECF8E; outline-offset: 2px;` (see §7) |
| **Active / Pressed** | Background darkens slightly; no scale; transform: none |
| **Disabled** | `opacity: 0.4`; `cursor: not-allowed`; no hover effects |
| **Error** | Border becomes `#E55353`; optional red helper text below |
| **Loading** | Content replaced with skeleton or spinner; pointer-events: none |
| **Selected** | Background highlight (`bg-surface-200`) + white text |

### Disabled pattern (all components):
```css
[disabled], [aria-disabled="true"] {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}
```

---

## 7. Accessibility & Focus

Supabase UI is built on **Radix UI primitives**, which handle keyboard navigation, ARIA roles, and focus management by default. The styling layer then adds visual focus indicators.

### 7.1 Focus Ring

```css
/* Applied globally via Tailwind ring utilities */
.focus-visible:focus-visible {
  outline: 2px solid #3ECF8E;   /* brand green */
  outline-offset: 2px;
  border-radius: inherit;
}

/* Inside dark surfaces — the ring is always green */
/* Inside very dark backgrounds, add a dark offset ring: */
.focus-visible-inset:focus-visible {
  outline: 2px solid #3ECF8E;
  outline-offset: -2px;
}
```

**Rules:**
- Focus rings are always visible on keyboard navigation (`:focus-visible`, not `:focus`)
- Never hide or reduce focus ring opacity below 100%
- Color is always `#3ECF8E` on dark; on light it uses a slightly darker `#2EB37C`
- Focus ring applies to: buttons, inputs, checkboxes, toggles, select triggers, dropdown items, nav items, tabs, radio buttons

### 7.2 Minimum Contrast Ratios

| Pair | Ratio | WCAG Level |
|---|---|---|
| `#EDEDED` on `#1C1C1C` | ~13:1 | AAA |
| `#A0A0A0` on `#1C1C1C` | ~5.7:1 | AA |
| `#3ECF8E` on `#1C1C1C` | ~7.1:1 | AA |
| `#6B6B6B` on `#1C1C1C` | ~3.2:1 | AA large text only |
| `#000000` on `#3ECF8E` | ~9.1:1 | AAA |

**Warning:** `foreground-muted` (`#6B6B6B`) does not meet AA contrast for body text. Use only for decorative captions, timestamps, and non-critical labels — never for primary information.

### 7.3 ARIA Patterns Used

| Component | ARIA role / attribute |
|---|---|
| Sidebar nav | `role="navigation"`, `aria-label="Main navigation"` |
| Active nav item | `aria-current="page"` |
| Dropdown menu | `role="menu"`, items `role="menuitem"` |
| Dialog / Modal | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` |
| Toast | `role="status"` or `role="alert"` for errors |
| Table | `role="grid"` for interactive data tables |
| Checkbox | `role="checkbox"`, `aria-checked` |
| Toggle/Switch | `role="switch"`, `aria-checked` |
| Loading state | `aria-busy="true"` on the container |
| Icon-only buttons | `aria-label="[action]"` always required |

---

## 8. Component Specifications

### 8.1 Topbar

```css
.topbar {
  height: 48px;
  background: #181818;
  border-bottom: 1px solid #2E2E2E;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 50;
}
```

**Breadcrumb:**
- Separator: `/` in `#4B4B4B`, `font-size: 12px`, `margin: 0 6px`
- Org name: small 16×16 avatar icon + name in `#A0A0A0`
- Project name: name in `#A0A0A0`
- Branch: `main` in `#EDEDED` + PRODUCTION badge (amber pill)
- Hover on any segment: `#EDEDED` + underline

**PRODUCTION environment badge:**
```css
border: 1px solid #F5A524;
color: #F5A524;
background: rgba(245, 165, 36, 0.08);
border-radius: 4px;
font-size: 10px;
font-weight: 600;
letter-spacing: 0.08em;
text-transform: uppercase;
padding: 1px 6px;
```

**Primary CTA — "Upgrade to Pro":**
```css
background: #3ECF8E;
color: #000;
border-radius: 6px;
font-size: 13px;
font-weight: 600;
padding: 6px 14px;
```

### 8.2 Sidebar Navigation

```css
.sidebar {
  width: 56px;            /* collapsed */
  /* width: 210px; */     /* expanded */
  background: #181818;
  border-right: 1px solid #2A2A2A;
  display: flex;
  flex-direction: column;
  padding: 8px 0;
  overflow: hidden;
  transition: width 200ms ease-in-out;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  margin: 1px 6px;
  border-radius: 6px;
  color: #A0A0A0;
  font-size: 13px;
  font-weight: 400;
  cursor: pointer;
  transition: background 100ms, color 100ms;
  white-space: nowrap;
}

.nav-item:hover {
  background: #252525;
  color: #EDEDED;
}

.nav-item.active {
  background: #2E2E2E;
  color: #EDEDED;
  font-weight: 500;
}

.nav-item .icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  stroke-width: 1.5;
}

/* Group separator */
.nav-divider {
  height: 1px;
  background: #282828;
  margin: 6px 12px;
}

/* Advisors — amber dot badge on icon */
.nav-item-advisors .icon-badge {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #F5A524;
  position: absolute;
  top: 2px;
  right: 2px;
}
```

**Section groups visible in screenshots:**
1. Project Overview, Table Editor, SQL Editor
2. Database, Authentication, Storage, Edge Functions, Realtime
3. Advisors *(amber dot)*, Observability, Logs, Integrations
4. Project Settings
5. *(bottom)* Theme toggle, User avatar

### 8.3 Cards & Panels

```css
/* Standard card */
.card {
  background: #252525;
  border: 1px solid #2E2E2E;
  border-radius: 8px;
  padding: 16px;
}

/* Hoverable card (integration cards) */
.card-interactive:hover {
  background: #2A2A2A;
  border-color: #3D3D3D;
  cursor: pointer;
}

/* Integration card — image preview on top */
.card-integration {
  background: #1E1E1E;
  border: 1px solid #2E2E2E;
  border-radius: 8px;
  overflow: hidden;
}
.card-integration-preview {
  height: 176px;
  background: #141414;
  overflow: hidden;
  /* Contains dark code/UI preview imagery */
}
.card-integration-body {
  padding: 16px;
}
.card-integration-title {
  font-size: 14px;
  font-weight: 600;
  color: #EDEDED;
  margin-bottom: 4px;
}
.card-integration-desc {
  font-size: 12px;
  color: #6B6B6B;
  margin-bottom: 12px;
}

/* "Get connected" feature grid card */
.card-feature {
  background: #1E1E1E;
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
  cursor: pointer;
  transition: background 100ms;
}
.card-feature:hover { background: #262626; }
.card-feature-icon { color: #A0A0A0; width: 20px; height: 20px; }
.card-feature-title { font-size: 13px; font-weight: 600; color: #EDEDED; }
.card-feature-subtitle { font-size: 11px; color: #6B6B6B; }
/* Feature grid uses 1px gap on dark bg to simulate borders between cells */
.feature-grid-wrapper {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 1px;
  background: #2E2E2E;
  border: 1px solid #2E2E2E;
  border-radius: 8px;
  overflow: hidden;
}
```

### 8.4 Badges & Pills

```css
/* Base badge */
.badge {
  display: inline-flex;
  align-items: center;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 2px 7px;
  line-height: 1.4;
  white-space: nowrap;
}

.badge-official {
  background: transparent;
  border: 1px solid #3D3D3D;
  color: #6B6B6B;
}
.badge-alpha {
  background: rgba(228, 116, 0, 0.12);
  border: 1px solid rgba(228, 116, 0, 0.35);
  color: #E47400;
}
.badge-beta {
  background: rgba(217, 119, 6, 0.10);
  border: 1px solid rgba(217, 119, 6, 0.30);
  color: #D97706;
}
.badge-installed {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #3ECF8E;
  font-size: 12px;
  font-weight: 500;
  /* No border; checkmark icon precedes text */
}
.badge-free {
  background: transparent;
  border: 1px solid #3D3D3D;
  color: #6B6B6B;
  font-size: 9px;
  padding: 1px 5px;
}
.badge-production {
  background: rgba(245, 165, 36, 0.08);
  border: 1px solid #F5A524;
  color: #F5A524;
}
```

### 8.5 Metric / Stat Cards

```css
.metric-card {
  background: #242424;
  border: 1px solid #2E2E2E;
  border-radius: 8px;
  padding: 16px;
}
.metric-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #6B6B6B;
  margin-bottom: 4px;
}
.metric-value {
  font-size: 24px;
  font-weight: 600;
  color: #EDEDED;
  line-height: 1.2;
  margin-bottom: 12px;
}
.metric-chart-empty {
  border: 1px dashed #2E2E2E;
  border-radius: 6px;
  height: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #4B4B4B;
  font-size: 11px;
}
.metric-chart-empty svg { opacity: 0.4; }
```

### 8.6 Buttons

```css
/* Primary */
.btn { border-radius: 6px; font-size: 13px; font-weight: 500; height: 32px; padding: 0 14px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; transition: background 100ms, border-color 100ms; }

.btn-primary   { background: #3ECF8E; color: #000; border: 1px solid transparent; }
.btn-primary:hover  { background: #34B27B; }
.btn-primary:active { background: #2E9E6B; }

/* Secondary / Default */
.btn-default   { background: #252525; color: #EDEDED; border: 1px solid #3D3D3D; }
.btn-default:hover  { background: #2E2E2E; border-color: #505050; }

/* Ghost */
.btn-ghost     { background: transparent; color: #A0A0A0; border: 1px solid transparent; }
.btn-ghost:hover    { background: #252525; color: #EDEDED; border-color: #3D3D3D; }

/* Destructive */
.btn-destructive { background: transparent; color: #E55353; border: 1px solid #E55353; }
.btn-destructive:hover { background: rgba(229,83,83,0.10); }

/* Outline */
.btn-outline   { background: transparent; color: #EDEDED; border: 1px solid #3D3D3D; }
.btn-outline:hover  { background: #252525; }

/* Disabled (all variants) */
.btn:disabled  { opacity: 0.4; cursor: not-allowed; pointer-events: none; }

/* With icon */
.btn-icon-only { width: 32px; padding: 0; justify-content: center; }

/* "Ask Assistant" special */
.btn-assistant {
  background: #252525;
  border: 1px solid #2E2E2E;
  color: #A0A0A0;
  font-size: 12px;
  height: 28px;
  padding: 0 10px;
  gap: 5px;
}
.btn-assistant .ai-icon { color: #3ECF8E; }
```

### 8.7 Data Table

```css
.data-table { width: 100%; border-collapse: collapse; font-family: "JetBrains Mono", monospace; font-size: 12px; }

.data-table thead tr {
  background: #1E1E1E;
  border-bottom: 1px solid #2E2E2E;
}
.data-table th {
  height: 36px;
  padding: 0 12px;
  text-align: left;
  color: #A0A0A0;
  font-size: 11px;
  font-weight: 500;
  border-right: 1px solid #2A2A2A;
  white-space: nowrap;
  user-select: none;
}
.data-table th .col-type {
  color: #4B4B4B;
  font-size: 10px;
  margin-left: 4px;
  font-weight: 400;
}
.data-table th .col-icon { color: #3ECF8E; margin-right: 4px; } /* PK = green key */

.data-table tbody tr {
  height: 32px;
  border-bottom: 1px solid #222222;
  transition: background 60ms;
}
.data-table tbody tr:hover { background: #252525; }
.data-table tbody tr.selected { background: #1A4A34; } /* green tint for selected */

.data-table td {
  padding: 0 12px;
  color: #EDEDED;
  border-right: 1px solid #242424;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 260px;
}
.data-table td.null-value { color: #4B4B4B; }
.data-table td.uuid-value { color: #6B6B6B; font-size: 11px; }

/* Row checkbox column */
.data-table .col-check { width: 36px; padding: 0; text-align: center; }
```

### 8.8 Dropdowns & Selects

```css
.dropdown-trigger {
  background: #252525;
  border: 1px solid #3D3D3D;
  border-radius: 6px;
  color: #EDEDED;
  font-size: 12px;
  height: 28px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
.dropdown-trigger:hover { border-color: #505050; background: #2A2A2A; }

.dropdown-content {
  background: #2A2A2A;
  border: 1px solid #3D3D3D;
  border-radius: 8px;
  padding: 4px;
  min-width: 160px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.5);
  animation: dropdownIn 120ms ease-out;
}
@keyframes dropdownIn {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

.dropdown-item {
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 13px;
  color: #EDEDED;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}
.dropdown-item:hover { background: #353535; }
.dropdown-item.active { color: #3ECF8E; }
.dropdown-item.destructive { color: #E55353; }
.dropdown-separator { height: 1px; background: #2E2E2E; margin: 4px 0; }
.dropdown-label { font-size: 10px; color: #6B6B6B; text-transform: uppercase; letter-spacing: 0.06em; padding: 4px 10px 2px; }
```

### 8.9 Search Input

```css
.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}
.search-input-icon {
  position: absolute;
  left: 8px;
  color: #6B6B6B;
  width: 14px;
  pointer-events: none;
}
.search-input {
  background: #252525;
  border: 1px solid #3D3D3D;
  border-radius: 6px;
  color: #EDEDED;
  font-size: 13px;
  height: 32px;
  padding: 0 32px;       /* space for icon left, kbd hint right */
  width: 220px;
  transition: border-color 100ms, width 200ms;
}
.search-input:focus {
  border-color: #3ECF8E;
  width: 280px;
  outline: none;
}
.search-input::placeholder { color: #6B6B6B; }
.search-kbd {
  position: absolute;
  right: 8px;
  background: #333;
  border: 1px solid #444;
  border-radius: 4px;
  color: #6B6B6B;
  font-size: 10px;
  padding: 1px 5px;
  pointer-events: none;
}
```

### 8.10 Tabs

```css
.tabs-list {
  display: flex;
  border-bottom: 1px solid #2E2E2E;
  gap: 0;
}
.tab-trigger {
  padding: 8px 16px;
  font-size: 13px;
  color: #6B6B6B;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  cursor: pointer;
  transition: color 100ms, border-color 100ms;
  white-space: nowrap;
}
.tab-trigger:hover { color: #A0A0A0; }
.tab-trigger[data-state="active"] {
  color: #EDEDED;
  border-bottom-color: #3ECF8E;
  font-weight: 500;
}
```

---

## 9. Form Components

### 9.1 Text Input

```css
.input {
  background: #1C1C1C;
  border: 1px solid #2E2E2E;
  border-radius: 6px;
  color: #EDEDED;
  font-size: 13px;
  height: 32px;
  padding: 0 10px;
  width: 100%;
  transition: border-color 100ms;
}
.input::placeholder { color: #4B4B4B; }
.input:hover  { border-color: #3D3D3D; }
.input:focus  { border-color: #3ECF8E; outline: none; box-shadow: 0 0 0 2px rgba(62,207,142,0.15); }
.input.error  { border-color: #E55353; }
.input.error:focus { box-shadow: 0 0 0 2px rgba(229,83,83,0.15); }
.input:disabled { opacity: 0.4; cursor: not-allowed; }

/* With prefix/suffix icon */
.input-group { position: relative; }
.input-prefix { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #6B6B6B; }
.input-suffix { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: #6B6B6B; }
.input-with-prefix { padding-left: 32px; }
.input-with-suffix { padding-right: 32px; }
```

### 9.2 Textarea

```css
.textarea {
  background: #1C1C1C;
  border: 1px solid #2E2E2E;
  border-radius: 6px;
  color: #EDEDED;
  font-size: 13px;
  padding: 8px 10px;
  width: 100%;
  min-height: 80px;
  resize: vertical;
  font-family: inherit;
  line-height: 1.6;
  transition: border-color 100ms;
}
.textarea:focus { border-color: #3ECF8E; outline: none; box-shadow: 0 0 0 2px rgba(62,207,142,0.15); }
```

### 9.3 Form Layout

```css
.form-item { display: flex; flex-direction: column; gap: 6px; }

.form-label {
  font-size: 13px;
  font-weight: 500;
  color: #EDEDED;
}
.form-label-optional {
  font-size: 11px;
  color: #6B6B6B;
  font-weight: 400;
  margin-left: 4px;
}
.form-description {
  font-size: 12px;
  color: #6B6B6B;
  line-height: 1.5;
}
.form-error {
  font-size: 12px;
  color: #E55353;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Side-by-side label + input (horizontal layout) */
.form-item-horizontal {
  display: grid;
  grid-template-columns: 200px 1fr;
  align-items: start;
  gap: 16px;
}
```

### 9.4 Checkbox

```css
.checkbox {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: 1px solid #3D3D3D;
  background: #1C1C1C;
  appearance: none;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background 100ms, border-color 100ms;
  flex-shrink: 0;
}
.checkbox:hover { border-color: #3ECF8E; }
.checkbox:checked {
  background: #3ECF8E;
  border-color: #3ECF8E;
}
.checkbox:checked::after {
  content: '';
  width: 9px;
  height: 6px;
  border-left: 2px solid #000;
  border-bottom: 2px solid #000;
  transform: rotate(-45deg) translateY(-1px);
}
.checkbox:focus-visible { outline: 2px solid #3ECF8E; outline-offset: 2px; }
.checkbox:indeterminate {
  background: #3ECF8E;
  border-color: #3ECF8E;
}
.checkbox:indeterminate::after {
  content: '';
  width: 8px;
  height: 2px;
  background: #000;
  border-radius: 1px;
}
```

### 9.5 Toggle / Switch

```css
.switch {
  width: 36px;
  height: 20px;
  border-radius: 9999px;
  background: #3D3D3D;
  border: none;
  cursor: pointer;
  position: relative;
  transition: background 150ms;
  flex-shrink: 0;
}
.switch[aria-checked="true"] { background: #3ECF8E; }
.switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 150ms;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}
.switch[aria-checked="true"]::after { transform: translateX(16px); }
.switch:focus-visible { outline: 2px solid #3ECF8E; outline-offset: 2px; }
.switch:disabled { opacity: 0.4; cursor: not-allowed; }
```

### 9.6 Radio Group

```css
.radio {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid #3D3D3D;
  background: #1C1C1C;
  appearance: none;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: border-color 100ms;
  flex-shrink: 0;
}
.radio:hover { border-color: #3ECF8E; }
.radio:checked {
  border-color: #3ECF8E;
  background: #1C1C1C;
}
.radio:checked::after {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #3ECF8E;
}
```

### 9.7 Select

```css
.select-trigger {
  background: #1C1C1C;
  border: 1px solid #2E2E2E;
  border-radius: 6px;
  color: #EDEDED;
  font-size: 13px;
  height: 32px;
  padding: 0 10px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: border-color 100ms;
}
.select-trigger:hover { border-color: #3D3D3D; }
.select-trigger:focus { border-color: #3ECF8E; outline: none; }
.select-trigger .chevron { color: #6B6B6B; width: 14px; }
.select-placeholder { color: #4B4B4B; }

.select-content {
  background: #2A2A2A;
  border: 1px solid #3D3D3D;
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.5);
}
.select-item {
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 13px;
  color: #EDEDED;
  cursor: pointer;
}
.select-item:hover { background: #353535; }
.select-item[data-selected] { color: #3ECF8E; }
```

### 9.8 Multi-line Inline Validation

```
[Label]          [Optional]
[_____Input___________________________]
[Helper text — describes expected value]
[✕ Error message — shown on invalid]    ← #E55353
```

---

## 10. Code Editor & SQL Surface

### 10.1 Editor Shell

```css
.sql-editor {
  background: #1A1A1A;
  border: 1px solid #2E2E2E;
  border-radius: 8px;
  font-family: "JetBrains Mono", monospace;
  font-size: 13px;
  line-height: 1.7;
  overflow: hidden;
}
.sql-editor-gutter {
  background: #1A1A1A;
  border-right: 1px solid #252525;
  color: #4B4B4B;
  font-size: 12px;
  padding: 0 12px;
  text-align: right;
  min-width: 40px;
  user-select: none;
}
.sql-editor-line:hover .sql-editor-gutter { color: #6B6B6B; }
.sql-editor-cursor { border-left: 2px solid #3ECF8E; }
```

### 10.2 Syntax Highlighting Palette

| Token type | Color | Hex |
|---|---|---|
| Keywords (`SELECT`, `FROM`, `WHERE`) | Green | `#3ECF8E` |
| String literals | Amber/orange | `#F5A524` |
| Numbers | Light blue | `#79B8FF` |
| Functions | Light purple | `#B294BB` |
| Column names / identifiers | White/light | `#EDEDED` |
| Table names | Soft green | `#7CCD7C` |
| Comments (`--`) | Gray | `#6B6B6B` |
| Operators (`=`, `>`, `*`) | Muted white | `#A0A0A0` |
| Type names | Warm orange | `#E8A87C` |
| NULL / boolean constants | Blue-gray | `#79B8FF` |
| Error underline | Red dashed | `#E55353` |

### 10.3 Selection & Active Line

```css
.editor-selection { background: rgba(62, 207, 142, 0.12); }
.editor-active-line { background: rgba(255, 255, 255, 0.03); }
.editor-matching-bracket { background: rgba(62, 207, 142, 0.20); border: 1px solid #3ECF8E; }
```

### 10.4 Autocomplete Popup

```css
.autocomplete-popup {
  background: #2A2A2A;
  border: 1px solid #3D3D3D;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.5);
  max-height: 240px;
  overflow-y: auto;
}
.autocomplete-item {
  padding: 6px 12px;
  font-size: 12px;
  color: #EDEDED;
  display: flex;
  align-items: center;
  gap: 8px;
}
.autocomplete-item.active { background: #353535; }
.autocomplete-type { color: #6B6B6B; font-size: 10px; }
/* Type color dots */
.type-table    { color: #3ECF8E; }
.type-column   { color: #79B8FF; }
.type-function { color: #B294BB; }
.type-keyword  { color: #F5A524; }
```

---

## 11. Data Visualization & Charts

Supabase Studio uses **Recharts** for its built-in analytics charts. All chart styling follows the system color palette.

### 11.1 Chart Color Palette

Use these colors in order for multi-series charts:

| Series | Color | Hex | Usage |
|---|---|---|---|
| Series 1 (primary) | Supabase Green | `#3ECF8E` | Default / main line |
| Series 2 | Blue | `#3B82F6` | Secondary series |
| Series 3 | Amber | `#F5A524` | Tertiary |
| Series 4 | Purple | `#8B5CF6` | Quaternary |
| Series 5 | Pink | `#EC4899` | Quinary |
| Series 6 | Cyan | `#06B6D4` | Sixth |
| Error / Danger | Red | `#E55353` | Error rate lines |
| Neutral | Gray | `#6B6B6B` | Baseline / reference |

### 11.2 Chart Container

```css
.chart-container {
  background: #242424;
  border: 1px solid #2E2E2E;
  border-radius: 8px;
  padding: 16px;
}
.chart-title {
  font-size: 13px;
  font-weight: 500;
  color: #EDEDED;
  margin-bottom: 4px;
}
.chart-subtitle {
  font-size: 11px;
  color: #6B6B6B;
  margin-bottom: 16px;
}
```

### 11.3 Recharts / SVG Styles

```css
/* Grid lines */
.recharts-cartesian-grid line { stroke: #2A2A2A; stroke-dasharray: none; }

/* Axis labels */
.recharts-text { fill: #6B6B6B; font-size: 11px; font-family: "JetBrains Mono", monospace; }

/* Axis line */
.recharts-cartesian-axis-line { stroke: #2E2E2E; }
.recharts-cartesian-axis-tick-line { display: none; }

/* Line chart */
.recharts-line { stroke-width: 2px; }
.recharts-dot { stroke-width: 2px; fill: #1C1C1C; r: 3px; }
.recharts-dot.recharts-dot-active { r: 5px; }

/* Area chart — fill under the line */
.recharts-area-area { fill-opacity: 0.1; }

/* Bar chart */
.recharts-bar-rectangle { rx: 2px; }

/* Tooltip */
.recharts-tooltip-wrapper .recharts-default-tooltip {
  background: #2A2A2A !important;
  border: 1px solid #3D3D3D !important;
  border-radius: 8px !important;
  padding: 8px 12px !important;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important;
}
.recharts-tooltip-label { color: #A0A0A0 !important; font-size: 12px !important; margin-bottom: 4px !important; }
.recharts-tooltip-item { color: #EDEDED !important; font-size: 12px !important; }

/* Legend */
.recharts-legend-item-text { color: #A0A0A0 !important; font-size: 11px !important; }
```

### 11.4 Bar Chart (Logs / Histogram)

```css
/* Logs histogram bars */
.log-bar { fill: #3ECF8E; opacity: 0.7; rx: 2; }
.log-bar:hover { opacity: 1; }
.log-bar.error { fill: #E55353; }
.log-bar.warning { fill: #F5A524; }
```

### 11.5 Empty Chart State

```css
.chart-empty {
  border: 1px dashed #2E2E2E;
  border-radius: 6px;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.chart-empty-icon { color: #4B4B4B; opacity: 0.5; width: 20px; height: 20px; }
.chart-empty-text { font-size: 11px; color: #4B4B4B; }
```

### 11.6 Progress / Score Bars (EduAI-adapted)

```css
.progress-bar-track {
  background: #252525;
  border-radius: 9999px;
  height: 6px;
  width: 100%;
  overflow: hidden;
}
.progress-bar-fill {
  height: 100%;
  border-radius: 9999px;
  background: #3ECF8E;
  transition: width 500ms ease-out;
}
/* Score tiers */
.progress-fill-excellent { background: #3ECF8E; }   /* 80–100 */
.progress-fill-good      { background: #3B82F6; }   /* 60–79  */
.progress-fill-fair      { background: #F5A524; }   /* 40–59  */
.progress-fill-low       { background: #E55353; }   /* 0–39   */
```

---

## 12. Loading, Skeleton & Progress

### 12.1 Skeleton

```css
@keyframes skeleton-shimmer {
  0%   { background-position: -600px 0; }
  100% { background-position: 600px 0; }
}

.skeleton {
  background: linear-gradient(
    90deg,
    #252525 25%,
    #2E2E2E 50%,
    #252525 75%
  );
  background-size: 1200px 100%;
  animation: skeleton-shimmer 1.5s linear infinite;
  border-radius: 4px;
}

/* Skeleton shapes */
.skeleton-text  { height: 12px; border-radius: 4px; }
.skeleton-title { height: 18px; border-radius: 4px; }
.skeleton-card  { height: 80px; border-radius: 8px; }
.skeleton-avatar{ width: 32px; height: 32px; border-radius: 50%; }
.skeleton-badge { height: 20px; width: 64px; border-radius: 4px; }
```

### 12.2 Spinner

```css
@keyframes spin { to { transform: rotate(360deg); } }

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #2E2E2E;
  border-top-color: #3ECF8E;
  border-radius: 50%;
  animation: spin 600ms linear infinite;
}
.spinner-sm { width: 12px; height: 12px; border-width: 1.5px; }
.spinner-lg { width: 24px; height: 24px; border-width: 3px; }
```

### 12.3 Full-page Loading

```css
.page-loading {
  position: fixed;
  inset: 0;
  background: #1C1C1C;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
/* Contains logo + spinner below it */
```

### 12.4 Button Loading State

```css
.btn-loading {
  pointer-events: none;
  position: relative;
  color: transparent;
}
.btn-loading::after {
  content: '';
  position: absolute;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(0,0,0,0.2);
  border-top-color: #000;
  border-radius: 50%;
  animation: spin 600ms linear infinite;
}
/* On dark buttons, use white spinner */
.btn-ghost.btn-loading::after { border-top-color: #EDEDED; border-color: rgba(255,255,255,0.2); }
```

---

## 13. Modals, Sheets & Dialogs

### 13.1 Modal / Dialog

```css
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(2px);
  z-index: 100;
  animation: backdropIn 150ms ease;
}
@keyframes backdropIn { from { opacity: 0; } to { opacity: 1; } }

.modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #252525;
  border: 1px solid #3D3D3D;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.6);
  z-index: 101;
  width: 480px;
  max-width: calc(100vw - 32px);
  animation: modalIn 150ms ease-out;
}
@keyframes modalIn { from { opacity: 0; transform: translate(-50%,-48%); } to { opacity:1; transform: translate(-50%,-50%); } }

.modal-header {
  padding: 20px 20px 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.modal-title { font-size: 15px; font-weight: 600; color: #EDEDED; }
.modal-description { font-size: 13px; color: #A0A0A0; margin-top: 4px; }

.modal-body { padding: 16px 20px; }

.modal-footer {
  padding: 0 20px 20px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid #2E2E2E;
  padding-top: 16px;
  margin-top: 4px;
}

.modal-close {
  background: transparent;
  border: none;
  color: #6B6B6B;
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
}
.modal-close:hover { color: #EDEDED; background: #2E2E2E; }
```

### 13.2 Confirmation / Destructive Dialog

```css
.modal-destructive .modal-title { color: #E55353; }
.modal-destructive .modal { border-color: rgba(229,83,83,0.30); }
/* Confirm input: user must type project name before enabling delete */
.modal-confirm-input { margin-top: 12px; }
.modal-confirm-label { font-size: 12px; color: #A0A0A0; margin-bottom: 4px; }
```

### 13.3 Sheet / Side Drawer

```css
.sheet {
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  width: 420px;
  max-width: 90vw;
  background: #252525;
  border-left: 1px solid #3D3D3D;
  box-shadow: -8px 0 32px rgba(0,0,0,0.5);
  z-index: 101;
  display: flex;
  flex-direction: column;
  animation: sheetIn 200ms ease-out;
}
@keyframes sheetIn { from { transform: translateX(100%); } to { transform: translateX(0); } }

.sheet-header {
  padding: 20px;
  border-bottom: 1px solid #2E2E2E;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sheet-body { padding: 20px; flex: 1; overflow-y: auto; }
.sheet-footer { padding: 16px 20px; border-top: 1px solid #2E2E2E; }
```

---

## 14. Toast & Notification System

Supabase uses **Sonner** for toast notifications. Position is bottom-right.

```css
/* Toast container */
[data-sonner-toaster] {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  display: flex;
  flex-direction: column-reverse;
  gap: 8px;
}

/* Individual toast */
[data-sonner-toast] {
  background: #2A2A2A;
  border: 1px solid #3D3D3D;
  border-radius: 8px;
  padding: 12px 16px;
  min-width: 320px;
  max-width: 420px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  display: flex;
  align-items: flex-start;
  gap: 10px;
  animation: toastIn 200ms ease-out;
}
@keyframes toastIn { from { opacity: 0; transform: translateY(8px) scale(0.97); } to { opacity:1; transform: translateY(0) scale(1); } }

/* Toast variants — left border accent */
[data-type="success"] { border-left: 3px solid #3ECF8E; }
[data-type="error"]   { border-left: 3px solid #E55353; }
[data-type="warning"] { border-left: 3px solid #F5A524; }
[data-type="info"]    { border-left: 3px solid #3B82F6; }

.toast-title       { font-size: 13px; font-weight: 500; color: #EDEDED; }
.toast-description { font-size: 12px; color: #A0A0A0; margin-top: 2px; }
.toast-icon { flex-shrink: 0; margin-top: 1px; }
.toast-icon-success { color: #3ECF8E; }
.toast-icon-error   { color: #E55353; }
.toast-icon-warning { color: #F5A524; }
.toast-close { margin-left: auto; color: #6B6B6B; cursor: pointer; background: none; border: none; padding: 2px; border-radius: 4px; }
.toast-close:hover { color: #EDEDED; }
```

---

## 15. Dark vs Light Mode Deltas

Supabase supports dark, light, and system themes via `next-themes`. The CSS variable swap is the only mechanism — component classes don't change.

| Token | Dark Mode | Light Mode |
|---|---|---|
| `--background` | `#1C1C1C` | `#FFFFFF` |
| `--bg-surface-100` | `#252525` | `#F8F9FA` |
| `--bg-surface-200` | `#2C2C2C` | `#F0F2F5` |
| `--border-default` | `#2E2E2E` | `#E2E8F0` |
| `--border-strong` | `#3D3D3D` | `#CBD5E1` |
| `--foreground-default` | `#EDEDED` | `#11181C` |
| `--foreground-light` | `#A0A0A0` | `#475569` |
| `--foreground-muted` | `#6B6B6B` | `#94A3B8` |
| `--brand` | `#3ECF8E` | `#2EA070` (slightly darker for contrast) |
| `--input-bg` | `#1C1C1C` | `#FFFFFF` |
| `--sidebar-bg` | `#181818` | `#F1F3F5` |
| `--dropdown-bg` | `#2A2A2A` | `#FFFFFF` |
| `--shadow` | `rgba(0,0,0,0.5)` | `rgba(0,0,0,0.08)` |

**Light mode specific notes:**
- Sidebar uses `#F1F3F5` background, with `#E2E8F0` active item highlight
- Cards use white with `#E2E8F0` borders
- Text is near-black (`#11181C`) — Supabase's "Bunker" brand colour
- Active nav item in light = `#E2E8F0` bg + `#11181C` text
- Brand green darkens to `#2EA070` to maintain contrast on white

---

## 16. Animation & Motion

### Principles
- Motion is functional, not decorative. It communicates state changes.
- Durations are short. Under 200ms for UI micro-interactions.
- Never animate layout properties (width, height); use transform/opacity instead.

### Duration Scale

| Name | Duration | Used for |
|---|---|---|
| `instant` | 60ms | Button hover backgrounds |
| `fast` | 120ms | Dropdown open, tooltip appear |
| `normal` | 200ms | Drawer, modal enter, sidebar expand |
| `slow` | 300ms | Page transitions, complex reveals |
| `skeleton` | 1500ms loop | Shimmer animations |

### Easing Functions

| Name | Value | Used for |
|---|---|---|
| `ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Enter animations (things entering screen) |
| `ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Exit animations (things leaving) |
| `ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | Size/layout transitions |
| `spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Sonner toasts (slight overshoot) |
| `linear` | `linear` | Spinners, skeleton shimmer |

### Animation Catalogue

| Element | Type | Duration | Easing |
|---|---|---|---|
| Dropdown menu | opacity + translateY(−4px→0) | 120ms | ease-out |
| Modal backdrop | opacity | 150ms | ease-out |
| Modal panel | opacity + translateY(−8px→0) | 150ms | ease-out |
| Sheet drawer | translateX(100%→0) | 200ms | ease-out |
| Sidebar expand | width | 200ms | ease-in-out |
| Toast appear | opacity + translateY(8px→0) + scale(0.97→1) | 200ms | spring |
| Input focus border | border-color | 100ms | ease |
| Button hover bg | background-color | 60ms | ease |
| Progress bar fill | width | 500ms | ease-out |
| Skeleton shimmer | background-position | 1500ms loop | linear |
| AI icon pulse | transform: scale + rotate | 1500ms loop | ease-in-out |
| Tab underline slide | (no animate; instant switch) | — | — |

---

## 17. Icon System

- **Library:** [Lucide Icons](https://lucide.dev/) — `lucide-react ^0.436.0`
- **Stroke width:** `1.5px` (Lucide default — do not override)
- **Color:** `currentColor` always — icon inherits parent text color
- **Never use filled icon variants** in the dashboard UI

### Size Scale

| Context | Size |
|---|---|
| Inline text | 14px |
| Nav sidebar | 16px |
| Button (with label) | 14px |
| Button (icon only) | 16px |
| Feature / card icon | 20px |
| Section title icon | 14px |
| Empty state | 24px |
| Toast notification | 16px |
| Modal title | 18px |

### Custom AI Icon
- Animated sparkle/diamond SVG used for AI features
- Keyframe: rotate 0→360deg + scale 1→1.1→1, 1.5s infinite
- Color: `#3ECF8E`

### Avatar
```css
.avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #3D3D3D;
  border: 1px solid #505050;
  overflow: hidden;
  font-size: 11px;
  font-weight: 600;
  color: #EDEDED;
  display: grid;
  place-items: center;
}
```

---

## 18. CSS Variables — Full Reference

Drop this into your `globals.css`:

```css
/* ─── Dark Theme (default) ────────────────────────── */
:root,
[data-theme="dark"] {

  /* Backgrounds */
  --background:              #1C1C1C;
  --background-studio:       #1E1E1E;
  --background-sidebar:      #181818;
  --background-surface-75:   #222222;
  --background-surface-100:  #252525;
  --background-surface-200:  #2C2C2C;
  --background-surface-300:  #333333;
  --background-overlay:      rgba(28, 28, 28, 0.8);
  --background-input:        #1C1C1C;

  /* Borders */
  --border-muted:            #252525;
  --border-default:          #2E2E2E;
  --border-strong:           #3D3D3D;
  --border-overlay:          #484848;

  /* Text */
  --foreground-default:      #EDEDED;
  --foreground-light:        #A0A0A0;
  --foreground-muted:        #6B6B6B;
  --foreground-faint:        #4B4B4B;
  --foreground-on-brand:     #000000;

  /* Brand */
  --brand:                   #3ECF8E;
  --brand-hover:             #34B27B;
  --brand-active:            #2E9E6B;
  --brand-muted:             #1A7A4A;
  --brand-subtle:            rgba(62, 207, 142, 0.10);

  /* Semantic */
  --warning:                 #F5A524;
  --warning-subtle:          rgba(245, 165, 36, 0.12);
  --destructive:             #E55353;
  --destructive-subtle:      rgba(229, 83, 83, 0.10);
  --info:                    #3B82F6;
  --info-subtle:             rgba(59, 130, 246, 0.10);
  --success:                 #3ECF8E;
  --success-subtle:          rgba(62, 207, 142, 0.10);

  /* Typography */
  --font-sans:               ui-sans-serif, -apple-system, BlinkMacSystemFont,
                             "Segoe UI", Inter, Roboto, sans-serif;
  --font-mono:               "JetBrains Mono", ui-monospace, "Cascadia Code",
                             "Fira Code", Consolas, monospace;

  /* Border radius */
  --radius-xs:               3px;
  --radius-sm:               4px;
  --radius:                  6px;
  --radius-md:               8px;
  --radius-lg:               12px;
  --radius-full:             9999px;

  /* Shadows */
  --shadow-sm:               0 1px 2px rgba(0,0,0,0.35);
  --shadow:                  0 2px 8px rgba(0,0,0,0.45);
  --shadow-md:               0 4px 16px rgba(0,0,0,0.50);
  --shadow-lg:               0 8px 32px rgba(0,0,0,0.60);

  /* Z-index scale */
  --z-base:    0;
  --z-raised:  10;
  --z-dropdown: 40;
  --z-sticky:  50;
  --z-overlay: 100;
  --z-modal:   101;
  --z-toast:   9999;
}

/* ─── Light Theme ──────────────────────────────────── */
[data-theme="light"] {
  --background:              #FFFFFF;
  --background-studio:       #FAFAFA;
  --background-sidebar:      #F1F3F5;
  --background-surface-75:   #F8F9FA;
  --background-surface-100:  #F0F2F5;
  --background-surface-200:  #E8ECF0;
  --background-surface-300:  #DDE3EA;
  --background-input:        #FFFFFF;

  --border-muted:            #EEF0F3;
  --border-default:          #E2E8F0;
  --border-strong:           #CBD5E1;
  --border-overlay:          #B2BFCC;

  --foreground-default:      #11181C;
  --foreground-light:        #475569;
  --foreground-muted:        #94A3B8;
  --foreground-faint:        #CBD5E1;
  --foreground-on-brand:     #000000;

  --brand:                   #2EA070;
  --brand-hover:             #26876A;
  --brand-subtle:            rgba(46, 160, 112, 0.10);

  --shadow-sm:               0 1px 2px rgba(0,0,0,0.06);
  --shadow:                  0 2px 8px rgba(0,0,0,0.08);
  --shadow-md:               0 4px 16px rgba(0,0,0,0.10);
  --shadow-lg:               0 8px 32px rgba(0,0,0,0.12);
}
```

---

## 19. Tailwind Configuration

```js
// tailwind.config.js
const { fontFamily } = require('tailwindcss/defaultTheme')

module.exports = {
  darkMode: ['class', '[data-theme*="dark"]'],
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT:     'var(--brand)',
          hover:       'var(--brand-hover)',
          muted:       'var(--brand-muted)',
          subtle:      'var(--brand-subtle)',
        },
        background: {
          DEFAULT:     'var(--background)',
          studio:      'var(--background-studio)',
          sidebar:     'var(--background-sidebar)',
          'surface-75':  'var(--background-surface-75)',
          'surface-100': 'var(--background-surface-100)',
          'surface-200': 'var(--background-surface-200)',
          'surface-300': 'var(--background-surface-300)',
        },
        border: {
          muted:       'var(--border-muted)',
          DEFAULT:     'var(--border-default)',
          strong:      'var(--border-strong)',
          overlay:     'var(--border-overlay)',
        },
        foreground: {
          DEFAULT:     'var(--foreground-default)',
          light:       'var(--foreground-light)',
          muted:       'var(--foreground-muted)',
          faint:       'var(--foreground-faint)',
        },
        status: {
          success:     '#3ECF8E',
          warning:     '#F5A524',
          error:       '#E55353',
          info:        '#3B82F6',
        },
        // Backwards-compatible scale alias
        scale: {
          100: '#1C1C1C',
          200: '#242424',
          300: '#2A2A2A',
          400: '#313131',
          500: '#3A3A3A',
          600: '#505050',
          700: '#6B6B6B',
          800: '#A0A0A0',
          900: '#C0C0C0',
          1000: '#D8D8D8',
          1100: '#E8E8E8',
          1200: '#EDEDED',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', ...fontFamily.sans],
        mono: ['"JetBrains Mono"', 'var(--font-mono)', ...fontFamily.mono],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '1.4', letterSpacing: '0.04em' }],
        xs:    ['11px', { lineHeight: '1.4' }],
        sm:    ['12px', { lineHeight: '1.5' }],
        base:  ['13px', { lineHeight: '1.6' }],
        md:    ['14px', { lineHeight: '1.5' }],
        lg:    ['15px', { lineHeight: '1.4' }],
        xl:    ['18px', { lineHeight: '1.3' }],
        '2xl': ['24px', { lineHeight: '1.2' }],
        '3xl': ['30px', { lineHeight: '1.15' }],
        '4xl': ['36px', { lineHeight: '1.1' }],
      },
      borderRadius: {
        xs:   'var(--radius-xs)',
        sm:   'var(--radius-sm)',
        DEFAULT: 'var(--radius)',
        md:   'var(--radius-md)',
        lg:   'var(--radius-lg)',
        full: 'var(--radius-full)',
      },
      boxShadow: {
        sm:   'var(--shadow-sm)',
        DEFAULT: 'var(--shadow)',
        md:   'var(--shadow-md)',
        lg:   'var(--shadow-lg)',
      },
      animation: {
        'skeleton-shimmer': 'skeleton-shimmer 1.5s linear infinite',
        'spin-fast': 'spin 600ms linear infinite',
        'fade-in': 'fadeIn 150ms ease-out',
        'slide-in-right': 'slideInRight 200ms ease-out',
        'drop-in': 'dropIn 120ms ease-out',
      },
      keyframes: {
        'skeleton-shimmer': {
          '0%':   { backgroundPosition: '-600px 0' },
          '100%': { backgroundPosition: '600px 0' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        slideInRight: {
          from: { transform: 'translateX(100%)' },
          to:   { transform: 'translateX(0)' },
        },
        dropIn: {
          from: { opacity: '0', transform: 'translateY(-4px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
      zIndex: {
        base:     '0',
        raised:   '10',
        dropdown: '40',
        sticky:   '50',
        overlay:  '100',
        modal:    '101',
        toast:    '9999',
      },
    },
  },
  plugins: [],
}
```

---

## 20. EduAI-Specific Patterns

These are Supabase-system patterns adapted for the EduAI student assessment platform.

### 20.1 Topic Mastery Card

```css
.topic-card {
  background: var(--background-surface-100);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.topic-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--foreground-default);
}
.topic-meta {
  font-size: 11px;
  color: var(--foreground-muted);
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
/* Progress bar colours based on mastery score */
.mastery-bar { height: 6px; border-radius: 9999px; overflow: hidden; background: var(--background-surface-300); }
.mastery-fill-high   { background: #3ECF8E; }   /* ≥80 */
.mastery-fill-mid    { background: #3B82F6; }   /* 60–79 */
.mastery-fill-low    { background: #F5A524; }   /* 40–59 */
.mastery-fill-danger { background: #E55353; }   /* <40 */

.mastery-score-label {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  color: var(--foreground-light);
}
```

### 20.2 Question Card

```css
.question-card {
  background: var(--background-surface-100);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: 20px;
}
.question-number {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--foreground-muted);
  font-family: var(--font-mono);
  margin-bottom: 8px;
}
.question-text {
  font-size: 15px;
  font-weight: 500;
  color: var(--foreground-default);
  line-height: 1.5;
  margin-bottom: 16px;
}
/* MCQ options */
.option {
  border: 1px solid var(--border-default);
  border-radius: var(--radius);
  padding: 10px 14px;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--foreground-light);
  cursor: pointer;
  transition: background 100ms, border-color 100ms, color 100ms;
}
.option:hover  { background: var(--background-surface-200); color: var(--foreground-default); border-color: var(--border-strong); }
.option.correct  { border-color: #3ECF8E; background: rgba(62,207,142,0.10); color: #3ECF8E; }
.option.incorrect{ border-color: #E55353; background: rgba(229,83,83,0.10); color: #E55353; }
.option.selected { border-color: var(--brand); background: var(--brand-subtle); color: var(--foreground-default); }
```

### 20.3 Assessment Score Summary

```css
.score-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}
/* Reuse .metric-card pattern */
.score-card { /* same as metric-card */ }
.score-grade {
  font-size: 32px;
  font-weight: 700;
  color: var(--brand);
  line-height: 1;
}
/* Grade color by performance */
.grade-a { color: #3ECF8E; }
.grade-b { color: #3B82F6; }
.grade-c { color: #F5A524; }
.grade-f { color: #E55353; }
```

### 20.4 Difficulty & Level Badges

```css
.badge-easy   { background: rgba(62,207,142,0.12);  border-color: rgba(62,207,142,0.35);  color: #3ECF8E; }
.badge-medium { background: rgba(245,165,36,0.12);  border-color: rgba(245,165,36,0.35);  color: #F5A524; }
.badge-hard   { background: rgba(229,83,83,0.10);   border-color: rgba(229,83,83,0.30);   color: #E55353; }
.badge-class  { background: rgba(59,130,246,0.10);  border-color: rgba(59,130,246,0.30);  color: #3B82F6; }
/* All share .badge base class */
```

---

## 21. Do's and Don'ts

### Do
- Use CSS variables everywhere; never hardcode hex values in component CSS
- Use `scale-*` or semantic tokens for all grays
- Use `#3ECF8E` only for primary CTAs, success, active states, focus rings, and brand marks
- Use uppercase + wide letter-spacing + monospace for all metric/data labels
- Use 1px borders (not shadows) for card elevation in dark mode
- Apply `border-radius: 4px` to badges, `6px` to buttons/inputs, `8px` to cards/panels
- Always provide `:focus-visible` outline on every interactive element
- Pair every icon-only button with an `aria-label`
- Use JetBrains Mono for all UUID columns, numeric values, code, and SQL

### Don't
- Don't use pure black (`#000`) or pure white (`#FFF`) for backgrounds or body text
- Don't use more than one accent color per UI region — green is the only accent
- Don't use `font-weight: 700+` in the dashboard UI (marketing pages are exempt)
- Don't use `:focus` alone — use `:focus-visible` to avoid showing rings on mouse clicks
- Don't add `drop-shadow` or `box-shadow` to cards on dark backgrounds
- Don't use `foreground-muted` (`#6B6B6B`) for primary readable text — contrast is too low
- Don't animate `width`, `height`, or `top/left` — animate `transform` and `opacity` instead
- Don't default to light mode; always build dark-first
- Don't use more than 4 colors in a single chart; use opacity variants of the same color instead of new hues
- Don't add decorative borders or dividers unless they carry structural meaning
