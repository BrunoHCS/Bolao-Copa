# Project AI Instructions (Fallback)

⚠️ **Claude Code users**: See `.claude/instructions.md` instead.

For other AI agents (Copilot, etc.):
- Next.js `app/` router, React 19, TypeScript, Supabase
- Client components only (use `lib/supabase.ts`)
- No pages router, no global state, no API routes unless critical
- Database: players, games, bets, groups, group_members
- Admin gated by `players.is_admin`

Key files: `app/page.tsx`, `app/admin/page.tsx`, `app/grupos/*`, `app/palpites/page.tsx`, `lib/supabase.ts`, `supabase/schema.sql`

Commands: `npm install`, `npm run dev`, `npm run build`, `npm run lint`

Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
