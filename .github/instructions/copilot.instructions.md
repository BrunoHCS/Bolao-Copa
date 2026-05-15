---
description: Project-specific guidance for AI coding agents working on the Bolão Copa 2026 app.
---

# Bolão Copa 2026 AI Instructions

## Project overview
- Small Next.js app using the `app/` router and client-side React.
- Uses React 19, Next 16, Tailwind/PostCSS, TypeScript, and Supabase for auth and data.
- Main data model is stored in Supabase tables: `players`, `games`, `bets`, `groups`, `group_members`.
- Authentication is handled through Supabase client-side auth in `lib/supabase.ts`.

## AI agent expectations
- Preserve the `app/` router structure; do not migrate to `pages/` or add a separate server framework.
- Keep existing `use client` components client-only unless a true server-rendered feature is required.
- Favor minimal changes: fix or enhance within current structure rather than introducing large architectural changes.
- Avoid adding new global state libraries, complex data layers, or unnecessary frameworks.
- Do not hardcode Supabase credentials or production values.

## Supabase and auth patterns
- The app uses `lib/supabase.ts` for the Supabase client and shared TypeScript types.
- Environment variables are expected from Supabase: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Admin access is gated by `players.is_admin`; admin pages and actions should respect this model.
- Results are stored in `games`, while user bets are stored in `bets` and scoring is derived from those values.

## Common conventions
- Keep business logic in client components and Supabase queries, not in new API routes unless necessary.
- Use existing page routes and components for functionality rather than introducing a new route layer.
- Preserve the app’s Portuguese UI and localization style when editing user-facing text.

## Commands and setup
- Use standard commands: `npm install`, `npm run dev`, `npm run build`, `npm run lint`.
- `supabase/schema.sql` defines the database schema.
- `README.md` contains deployment and Supabase setup instructions.

## Helpful files
- `app/page.tsx` — home page with ranking, upcoming games, and results.
- `app/admin/page.tsx` — admin results entry and game creation.
- `app/grupos/page.tsx` + `app/grupos/[id]/page.tsx` — group management.
- `app/palpites/page.tsx` — betting page.
- `app/login/page.tsx` — login page.
- `app/registro/page.tsx` — registration page.
- `lib/supabase.ts` — Supabase client and shared TypeScript models.
- `supabase/schema.sql` — database schema.
- `README.md` — deployment and setup guide.

## What to avoid
- Do not assume a `pages` router or older Next.js conventions.
- Do not introduce server-side API routes unless the feature explicitly needs server rendering or a route.
- Do not add large new dependencies or external state management.
- Do not leak credentials or hardcode environment-specific values.

> This file is intended to help AI coding agents stay aligned with the repo’s architecture and avoid changes that break the existing Supabase client-side flow.