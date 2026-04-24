---
name: framer-motion
description: "Use for Framer Motion integration and animation work in this repo. Covers Next.js client boundaries, accessibility, animation patterns, and performance guardrails. Trigger when creating page transitions, component enter/exit motion, gesture interactions, staggered lists, or layout animations."
argument-hint: "[target component/page] [goal: enter-exit|layout|gesture|stagger|route]"
---

# Framer Motion

## Scope

Use this skill for:

- Motion-enabled UI components
- Route/page transitions
- Dialog/drawer enter-exit flows
- Staggered list animations
- Shared layout transitions

## Project Rules

1. Use Framer Motion only inside client components.
2. Respect reduced motion (`useReducedMotion`) for non-essential effects.
3. Prefer `opacity` and `transform` animations.
4. Keep micro-interactions simple in Tailwind utilities when possible.
5. Default to subtle timing (roughly 0.2s to 0.35s).

## Next.js Integration

- Start any motion component file with:

```tsx
"use client"
```

- Import from Framer Motion:

```tsx
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
```

## Safe Defaults

- Enter:
  - `opacity: 0 -> 1`
  - `y: 8 -> 0`
  - duration `0.2 - 0.3`
- Exit:
  - slightly faster than enter

## Patterns

- **Component enter/exit**: `AnimatePresence` + keyed `motion.*`
- **Staggered children**: parent variants + `staggerChildren`
- **Layout transitions**: `layout` / `layoutId`
- **Gestures**: `whileHover`, `whileTap`, `drag` with constraints

## Performance

- Avoid heavy blur/filter animation.
- Avoid animating width/height/top/left unless required.
- Animate only changed elements; avoid wrapping large trees in `motion.div` unnecessarily.

## Validation Checklist

- [ ] No server-component usage of Framer Motion APIs
- [ ] Reduced-motion fallback exists for meaningful movement
- [ ] Keyboard/focus behavior still works with/without animation
- [ ] Lint/build succeeds after changes
