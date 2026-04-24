# Framer Motion in this project

This project uses `framer-motion` for state-driven and layout-aware animation.

## Install

```bash
corepack pnpm add framer-motion
```

## When to use Framer Motion vs Tailwind animation

- Use Framer Motion for:
  - enter/exit animation
  - route transitions
  - gesture-based interactions
  - staggered lists
  - layout transitions
- Use Tailwind utility animation for:
  - simple hover/focus polish
  - tiny loading indicators
  - static decorative effects

## Client component reminder

Framer Motion components must be used in client components.

```tsx
"use client"
import { motion } from "framer-motion"
```

## Baseline animation defaults

- Enter: 0.2s to 0.35s
- Exit: slightly faster than enter
- Prefer animating `opacity` + `transform`
- Avoid animating expensive layout properties when possible

## Accessibility

- Respect reduced motion:
  - use `useReducedMotion()` to reduce/disable non-essential movement
- Keep functional state changes visible even when animation is reduced

## Example: simple fade-up

```tsx
"use client"

import { motion } from "framer-motion"

export function FadeUp({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  )
}
```
