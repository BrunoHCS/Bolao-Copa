# Project AI instructions

## What this repo is
- `Bolão Copa 2026` is a small Next.js `app/` router web app for managing a World Cup betting pool.
- It uses React 19, Next 16, Tailwind/PostCSS, TypeScript, and Supabase for authentication and realtime data.
- The app is primarily client-side and calls Supabase from `app/*` client components via `lib/supabase.ts`.

## Key expectations for AI agents
- Preserve the Next.js `app/` router structure.
- Keep `use client` components client-only where currently declared.
- Do not introduce server-only APIs unless a feature explicitly needs server rendering or API routes.
- Keep the existing Supabase auth flow and database model in mind:
  - `players`, `games`, `bets`, `groups`, `group_members`
  - admin flow is gated by `players.is_admin`
  - results are saved in `games` and points are recalculated via Supabase RPCs/functions.

## Commands and environment
- Use `npm install`, `npm run dev`, `npm run build`, `npm run lint`.
- Environment variables come from Supabase:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Database schema is defined in `supabase/schema.sql`.

## What to avoid
- Do not assume a pages router or Next.js 13 conventions.
- Do not add new global state libraries or unnecessary frameworks.
- Do not create new API routes unless required; current logic is in client components and Supabase.
- Do not hardcode production credentials or environment values.

## Helpful files
- `app/page.tsx` — home page, ranking, upcoming games, bets display
- `app/admin/page.tsx` — admin results entry and game creation
- `app/grupos/page.tsx` + `app/grupos/[id]/page.tsx` — group management
- `app/palpites/page.tsx` — betting page
- `app/login/page.tsx` — login page
- `lib/supabase.ts` — Supabase client and type definitions
- `public/` — static assets
- `supabase/schema.sql` — database schema
- `README.md` — deployment and setup instructions
