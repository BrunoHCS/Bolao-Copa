# Bolão Copa 2026 - Claude Code Instructions

## Stack
- Next.js `app/` router, React 19, TypeScript, Supabase
- Client-first: all logic in client components via `lib/supabase.ts`
- No pages/ dir, no global state libs, no new API routes

## Architecture Rules
- Keep `use client` declarations
- Database: `players` (is_admin), `games`, `bets`, `groups`, `group_members`
- Auth: Supabase + username/password
- Points: 3 pts exact score, 1 pt correct winner

## Key Files
- `app/page.tsx` - home (ranking, games, bets)
- `app/admin/page.tsx` - results entry
- `app/grupos/*` - group management
- `app/palpites/page.tsx` - betting
- `app/login.tsx`, `app/registro.tsx` - auth
- `lib/supabase.ts` - client + types
- `supabase/schema.sql` - DB schema

## Env Vars
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Commands
```bash
npm install
npm run dev      # local dev
npm run build    # production build
npm run lint     # check code
```

## Constraints
❌ No pages router  
❌ No hardcoded credentials  
❌ No unnecessary frameworks  
❌ No server APIs (unless critical)
