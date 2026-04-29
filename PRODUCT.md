# Product

## Register

product

## Users

- **Students (grades 6–12):** Self-paced practice, exam prep, adaptive tests, performance reports, topic-level tracker, assignments, notifications, doubt help. Often on laptops or phones at home or after school, switching between focus blocks and shorter sessions.
- **Parents:** Read-only visibility into one linked child: dashboards, reports, assignments, notifications, doubt activity where exposed. Quick check-ins on mobile or desktop.
- **Teachers:** Class and grade or section views, assignment creation, monitoring, notifications to students and parents. Used during planning periods, at desks, sometimes on the go.

Context from the canonical product spec: `docs/EduAI_PDR_v3_0.md`.

## Product Purpose

EduAI is a **three-portal** adaptive learning and assessment product inside a single Next.js app: student, parent, and teacher surfaces with role-based routing. It delivers personalized practice, teacher-assigned work, performance intelligence, and multi-channel notifications so study time targets weak areas without ignoring curriculum alignment.

Success means high completion and engagement on practice and assignments, trustworthy AI-assisted flows, clear communication across roles, and reporting that parents and teachers can act on without noise.

## Brand Personality

**Clear, calm, capable.** The interface should feel like a serious study companion and school-adjacent tool: confident defaults, plain language, and density where power users need it without carnival visuals. Warmth comes from clarity and progress visibility, not from playful chrome.

Visual and component craft should align with the **Supabase design system** as a reference for product UI: restrained structure, consistent spacing rhythm, legible tables and forms, and predictable navigation. EduAI keeps its own brand color (see code tokens such as primary green); Supabase is a **pattern and quality bar**, not a logo or palette clone.

## Anti-references

- Generic “AI SaaS” look: purple gradients on white, interchangeable hero metrics, glassmorphism as decoration, gradient text for headings.
- Side-stripe accent borders on cards and alerts as the main hierarchy device.
- Identical icon-plus-title-plus-body card grids that could belong to any category.
- Childish or noisy gamification that reads younger than grades 6–12 or distracts from tasks.
- Dark mode chosen only because “dashboards look cool dark” without a scene-driven reason; same for flat light “because it is safe.”

## Design Principles

1. **Scene-driven theme and contrast:** Choose light or dark (and accent weight) from a concrete usage scene (who, device, ambient light, task), not from category stereotypes.
2. **Restraint by default, commitment where it earns attention:** Product surfaces favor tinted neutrals plus deliberate accent use; charts and status may use a fuller palette where data clarity requires it.
3. **Portals share language, differ by job:** Student, parent, and teacher flows reuse components and tokens but prioritize the primary task of each route (practice, visibility, operations).
4. **Trust before flair:** Numbers, dates, and states are unambiguous; motion supports orientation and feedback without animating layout for show.
5. **Specifications over vibes:** When product behavior is unclear, `docs/EduAI_PDR_v3_0.md` is the source of truth for flows and domain rules; impeccable shared laws handle craft-level bans (see project impeccable skill).

## Accessibility & Inclusion

Target **WCAG 2.1 AA** for audits and implementation, consistent with the PDR. Respect reduced motion preferences, do not rely on color alone for state, and keep touch targets and typography workable for younger teens and adults on shared devices.
