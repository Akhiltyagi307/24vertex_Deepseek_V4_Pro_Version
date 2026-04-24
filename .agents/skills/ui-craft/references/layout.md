# Layout & Composition

Spacing systems, grids, visual hierarchy, and spatial design.

> **Canonical product UI (Supabase Studio / EduAI):** [**design-v2.md**](./design-v2.md) §4–§5 — **8px grid** (multiples of 4, prefer 8); space scale 4–48px; component heights (topbar **48px**, buttons/inputs **32px**, table row **32px**, header row **36px**); radius scale (`3px` badges → `12px` large modals); app shell + sidebar widths; content grids. **Z-index:** `--z-dropdown: 40`, `--z-sticky: 50`, `--z-overlay: 100`, `--z-modal: 101`, `--z-toast: 9999` (design-v2 §18).

---

## Spacing System

Use a consistent scale — rem-based tokens, framework defaults, or custom. What matters is values come from a defined set, not arbitrary numbers.

- **`gap`** for sibling spacing (eliminates margin collapse)
- **`clamp()`** for fluid spacing that breathes on larger screens
- **Tight grouping** (8-12px) for related elements
- **Generous separation** (48-96px) between distinct sections
- **Varied spacing** within sections — not every row needs the same gap
- **Studio:** treat **8px** as the base; card padding **16–20px**; page section padding **24px** (design-v2 §4, §5.3)

### Semantic Tokens
```css
--space-xs:  0.25rem;   /* 4px */
--space-sm:  0.5rem;    /* 8px */
--space-md:  1rem;      /* 16px */
--space-lg:  1.5rem;    /* 24px */
--space-xl:  2rem;      /* 32px */
--space-2xl: 3rem;      /* 48px */
--space-3xl: 4rem;      /* 64px */
--space-4xl: 6rem;      /* 96px */
```

---

## Visual Hierarchy

### The Squint Test
Blur your eyes — can you identify: (1) most important element, (2) second most important, (3) clear groupings? If not, hierarchy is broken.

### Hierarchy Tools (fewer is better)
1. **Space alone** can be enough — generous whitespace draws the eye
2. **Weight** (font-weight, border-weight, shadow depth)
3. **Size** (scale differences 3-5x for drama, not 1.5x)
4. **Color** (add only when simpler means aren't sufficient)

### Reading Flow
In LTR: eye scans top-left → bottom-right naturally. But primary action placement depends on context (bottom-right in dialogs, top in navigation).

---

## Choosing Layout Tools

### Flexbox (1D — most layouts)
Rows of items, nav bars, button groups, card contents, component internals. Simpler and more appropriate for the majority of tasks.

```css
/* Responsive wrapping without media queries */
.container {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
}
```

### Grid (2D — page-level)
Page structure, dashboards, data-dense interfaces — when rows AND columns need coordinated control.

```css
/* Responsive grid without breakpoints */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-lg);
}

/* Complex page layout */
.page {
  display: grid;
  grid-template-areas:
    "nav    nav"
    "sidebar content"
    "footer  footer";
}
```

**Don't default to Grid** when Flexbox with `flex-wrap` would be simpler.

---

## Breaking Monotony

- **Don't default to card grids for everything** — spacing creates grouping naturally
- **Cards only when content is truly distinct and actionable** — never nest cards inside cards
- **Vary card sizes**, span columns, or mix cards with non-card content
- **Asymmetric compositions** — break centered-content patterns when it makes sense
- **Never** the hero metric layout (big number + small label + stats + gradient) as template

---

## Depth & Elevation

### Z-Index Scale (Semantic)

**Studio / design-v2** (use these for Supabase-shaped apps):
```css
--z-base:     0;
--z-raised:   10;
--z-dropdown: 40;
--z-sticky:   50;
--z-overlay:  100;
--z-modal:    101;
--z-toast:    9999;
```

Generic alternative when not on design-v2:
```css
--z-dropdown:       10;
--z-sticky:         20;
--z-modal-backdrop: 30;
--z-modal:          40;
--z-toast:          50;
--z-tooltip:        60;
```

Never use arbitrary values (999) unless they match a defined token.

### Shadow Scale

**Studio dark UI:** do **not** rely on drop shadows for card elevation — use **1px borders** and background steps (design-v2 §1, §21). Shadows are still used for **dropdowns, modals, toasts** per design-v2 §8.8, §13, §14.

Generic layered shadows (marketing / light SaaS):
```css
--shadow-sm:  0 1px 2px rgba(0,0,0,0.05);
--shadow-md:  0 4px 6px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.06);
--shadow-lg:  0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05);
--shadow-xl:  0 20px 25px rgba(0,0,0,0.1), 0 8px 10px rgba(0,0,0,0.04);
```

Always **layered** (ambient + direct light) where shadows are appropriate. Use elevation to reinforce hierarchy, not as decoration.

---

## Optical Adjustments

- **±1px nudges** when geometric centering looks visually off-center (common with icons)
- **Nested radii**: child ≤ parent, concentric so curves align
- **Balance icon/text lockups**: adjust weight, size, spacing, or color so they don't clash

---

## Never
- Arbitrary spacing outside your scale
- All spacing equal — variety creates hierarchy
- Wrap everything in cards — not everything needs a container
- Nest cards inside cards
- Center everything — left-aligned with asymmetry feels more designed
- Default to Grid when Flex would be simpler
- Arbitrary z-index values
