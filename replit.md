# OGS School Management System

A comprehensive school management platform for Okrika Grammar School, with role-based portals for admins, teachers, students, parents, accountants, and security officers.

## Run & Operate

- `pnpm --filter @workspace/ogs-school run dev` — run the frontend (port assigned by workflow)
- `pnpm --filter @workspace/api-server run dev` — run the API server
- Required secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 18 + Vite + Tailwind CSS v3
- Auth & DB: Supabase (auth + PostgreSQL)
- Routing: custom hash/history router (`src/components/hooks/useLocation.ts`)
- Build: Vite (static, served at `/`)

## Where things live

- `artifacts/ogs-school/src/App.tsx` — main router (path-switch based, role-aware)
- `artifacts/ogs-school/src/context/AuthContext.tsx` — Supabase auth context
- `artifacts/ogs-school/src/lib/supabase.ts` — Supabase client (reads `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`)
- `artifacts/ogs-school/src/lib/types.ts` — shared TypeScript types (Profile, etc.)
- `artifacts/ogs-school/src/pages/` — all page components, organized by role/module
- `artifacts/ogs-school/public/` — static assets (logo, favicon, letterhead PDF)

## Architecture decisions

- Frontend-only: all data lives in Supabase (no custom API server used by the app).
- Custom routing: uses `window.history.pushState` + popstate (not React Router or wouter), originally designed to also support Electron hash routing.
- Tailwind v3 with PostCSS (not v4 @tailwindcss/vite), configured via `postcss.config.js`.
- Role-based rendering: a single `App.tsx` switch renders different pages based on `profile.role` from Supabase.

## Product

- Multi-role school management: Super Admin, Admin, Principal, Head Teacher, Teacher, Student, Parent, Accountant, Security Officer
- Modules: Attendance, Grades, Exams, HR/Payroll, Finance/Fees, Library, Transport, Dormitory, Inventory, Behaviour, Lesson Plans, Messaging, Store, Clubs, Bulk Print, Reports

## Gotchas

- Do NOT use `@tailwindcss/vite` — this app uses Tailwind v3 with PostCSS. The vite config wires autoprefixer + tailwindcss via `css.postcss.plugins`.
- The `useLocation` hook reads `window.location.pathname` directly — works because the app is served at `/` (root previewPath).
- Supabase secrets must be set as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the app to start.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
