# Bolão Copa 2026 AI instructions

- Small Next.js app using the `app/` router, React 19, Next 16, Tailwind/PostCSS, TypeScript, and Supabase.
- The app is client-first and uses `lib/supabase.ts` for Supabase auth and realtime data.
- Keep existing `use client` components client-only unless a feature explicitly needs server rendering.
- Avoid adding new `pages/` routes, global state libraries, or unnecessary frameworks.
- Do not introduce server-only API routes unless a feature truly requires them.
- Use environment variables from Supabase: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Key files
- `app/page.tsx` — home page with ranking, upcoming games, and bets display
- `app/admin/page.tsx` — admin results entry and game creation
- `app/grupos/page.tsx` + `app/grupos/[id]/page.tsx` — group management
- `app/palpites/page.tsx` — betting page
- `app/login/page.tsx` — login page
- `app/registro/page.tsx` — registration page
- `lib/supabase.ts` — Supabase client and shared types
- `supabase/schema.sql` — database schema
- `README.md` — setup and deployment guide

## Related docs
- `AGENTS.md` — project overview and deployment steps
- `.github/instructions/copilot.instructions.md` — additional AI agent guidance
