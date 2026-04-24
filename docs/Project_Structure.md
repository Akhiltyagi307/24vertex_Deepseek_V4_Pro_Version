# EduAI — Project structure reference

This document summarizes **what is declared in `package.json` today**, **what the PDR targets for folders and routes** (`docs/EduAI_PDR_v3_0.md`), and **what you still need** (external services, env, and optional layout). Use it as a quick map when scaffolding the app.

---

## 1. Tooling and runtime (from `package.json`)

| Item | Value |
|------|--------|
| **Package name** | `examprep-ai-webapp` |
| **Package manager** | `pnpm@10.33.0` |
| **Node** | `>=22.0.0` |

### NPM scripts

| Script | Purpose |
|--------|---------|
| `dev` / `dev:clean` | Next.js dev server (clean wipes `.next` first) |
| `build` / `start` | Production build and server |
| `lint` | ESLint |
| `test` | Vitest (`vitest run`) |
| `db:generate` / `db:migrate` / `db:push` / `db:studio` | Drizzle Kit |
| `db:repair-profile-prefs` / `db:repair-profiles-pdr` | Custom repair scripts |

---

## 2. Installed dependencies (summary)

### Core framework

- **Next.js** `16.2.2` (App Router; PDR also references Turbopack in dev)
- **React** / **React DOM** `19.2.4`
- **TypeScript** `^5` (dev)

### UI and styling

- **Tailwind CSS** `^4` + **@tailwindcss/postcss** `^4`
- **shadcn** `^4.1.2` (CLI / project integration)
- **radix-ui** `^1.4.3`, **@base-ui/react** `^1.3.0`
- **class-variance-authority**, **clsx**, **tailwind-merge**
- **tw-animate-css**, **lucide-react**
- **next-themes** (theming)
- **framer-motion** + **motion** (animation)
- **sonner** (toasts)
- **vaul** (drawers)
- **react-easy-crop** (image cropping — e.g. avatars)

### Forms and validation

- **react-hook-form**, **@hookform/resolvers**, **zod**

### Backend / data

- **drizzle-orm**, **postgres** (Postgres driver)
- **drizzle-kit** (dev — migrations)
- **dotenv**

### Auth and database host (client libraries)

- **@supabase/supabase-js**, **@supabase/ssr**

### Email

- **resend**
- **@react-email/components**, **@react-email/render**

### Quality

- **eslint**, **eslint-config-next** `16.2.2`
- **vitest** `^4.1.3`
- **@types/node**, **@types/react**, **@types/react-dom**

---

## 3. PDR vs `package.json` (intentional gaps)

The PDR describes a full platform. Not everything is a Node dependency:

| PDR / product need | In `package.json`? | Notes |
|--------------------|--------------------|--------|
| **Supabase** (Postgres, Auth, RLS, Realtime, Storage, Edge) | Client libs only | Project needs a Supabase project, URLs, keys, and DB URL for Drizzle |
| **Claude / Anthropic** (AI generation, RAG) | No SDK listed | Add when implementing `/api/ai` and workers |
| **Redis / Upstash** (cache, rate limits) | No | Add client when implementing `CacheService` |
| **Vercel** | No | Deployment target |
| **Sentry** | No | Add when enabling error monitoring |
| **KaTeX** (math in questions) | No | PDR mentions LaTeX in test UI |
| **Biome** (lint/format) | No | PDR executive summary mentions Biome; **this repo uses ESLint** via `lint` |
| **BullMQ / job queues** | No | PDR mentions async jobs; may use Edge/cron instead |

Keep this table in mind so you do not assume “missing” packages are oversights — some are **external products** or **future sprint** additions.

---

## 4. Target app layout (from PDR §2.3)

The PDR specifies a **single Next.js 16 app** with **route groups** for three portals plus auth and API routes.

```
app/
├── (auth)/
│   ├── login/page.tsx
│   ├── signup/
│   │   ├── student/page.tsx
│   │   ├── parent/page.tsx
│   │   └── teacher/page.tsx
│   ├── forgot-password/page.tsx
│   └── layout.tsx
├── (student)/
│   ├── layout.tsx
│   ├── dashboard/page.tsx
│   ├── practice/
│   │   ├── configure/page.tsx
│   │   └── [testId]/page.tsx
│   ├── reports/
│   │   ├── page.tsx
│   │   └── [reportId]/page.tsx
│   ├── tracker/page.tsx
│   ├── assignments/
│   │   ├── page.tsx
│   │   └── [assignmentId]/page.tsx
│   ├── notifications/page.tsx
│   └── settings/page.tsx
├── (parent)/
│   ├── layout.tsx
│   ├── link-child/page.tsx
│   ├── dashboard/page.tsx
│   ├── tracker/page.tsx
│   ├── reports/
│   │   ├── page.tsx
│   │   └── [reportId]/page.tsx
│   ├── assignments/page.tsx
│   ├── notifications/page.tsx
│   └── settings/page.tsx
├── (teacher)/
│   ├── layout.tsx
│   ├── dashboard/page.tsx
│   ├── students/
│   │   ├── page.tsx
│   │   └── [studentId]/page.tsx
│   ├── tests/
│   │   ├── assign/page.tsx
│   │   └── history/page.tsx
│   ├── assignments/
│   │   ├── create/page.tsx
│   │   ├── page.tsx
│   │   └── [assignmentId]/page.tsx
│   ├── reports/page.tsx
│   ├── notifications/
│   │   ├── compose/page.tsx
│   │   └── page.tsx
│   ├── analytics/page.tsx
│   └── settings/page.tsx
├── api/
│   ├── auth/
│   ├── tests/
│   ├── assignments/
│   ├── performance/
│   ├── reports/
│   ├── notifications/
│   ├── users/
│   └── ai/
├── middleware.ts
└── layout.tsx
```

**Routing rules (PDR §2.2):** after auth, users go to `/(student|parent|teacher)/dashboard`; middleware restricts each route group by `role`.

---

## 5. Data layer layout (from PDR §4.2)

Drizzle schemas and migrations are **under `src/db/`** (not under `app/`):

```
src/db/
├── index.ts                 # DB client (e.g. DATABASE_URL → Supabase Postgres)
├── schema/
│   ├── profiles.ts
│   ├── subjects.ts
│   ├── topics.ts
│   ├── performance-tracker.ts
│   ├── tests.ts
│   ├── questions.ts
│   ├── student-answers.ts
│   ├── test-reports.ts
│   ├── assignments.ts
│   ├── assignment-submissions.ts
│   ├── notifications.ts
│   ├── email-log.ts
│   ├── parent-student-links.ts
│   ├── teacher-assignments.ts
│   ├── user-preferences.ts
│   └── audit-logs.ts
└── migrations/              # generated by drizzle-kit
```

Workflow: edit TypeScript schema → `pnpm db:generate` → `pnpm db:migrate` (or `db:push` in early dev, per team policy).

---

## 6. Other PDR-mentioned `src/` paths

| Path | Purpose |
|------|---------|
| `src/emails/*.tsx` | React Email templates (Resend) |
| `src/lib/prompts/` | Versioned Claude / AI prompt templates |

The PDR also describes **service-style logic** (test generation, assignments, notifications, analytics, cache, queues). A common convention is `src/lib/services/` or `src/server/` — the PDR does not mandate exact subfolders beyond `prompts` and `emails`.

---

## 7. Suggested supporting folders (not spelled out in PDR)

These align with Next.js 16 + shadcn and keep UI and server code organized:

- `components/` — shared UI (shadcn primitives and app composites)
- `components/ui/` — shadcn-generated components (typical convention)
- `lib/` — shared utilities, Supabase browser/server clients, constants
- `hooks/` — React hooks
- `public/` — static assets

Place **`middleware.ts`** at the project root or under `src/` depending on whether you use a `src` directory for `app/` (Next supports both; the PDR tree shows `app/` at root — mirror that or nest consistently).

---

## 8. Environment and project setup checklist

Minimum you will need beyond installing packages:

1. **Node22+** and **pnpm** (as per `engines` / `packageManager`).
2. **Supabase project**: Postgres URL for Drizzle, anon/service keys for `@supabase/*`.
3. **Resend** API key and verified domain for transactional email.
4. **`.env.local`** (or similar) for secrets — never commit real keys (repo may already ignore this).
5. Scaffold **`app/`**, **`src/db/`**, **`src/emails/`**, **`src/lib/prompts/`** per sections4–6 above.

---

## 9. Source documents

- Product and architecture detail: `docs/EduAI_PDR_v3_0.md` (especially §2.2–2.3, §4.1–4.2).
- Declared packages and scripts: root `package.json`.

---

*Last aligned with `package.json` and PDR v3.0 as present in the repo; update this file when the stack or folder conventions change.*
