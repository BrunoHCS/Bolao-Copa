# Bolão Copa 2026

Betting pool app for World Cup 2026.

## Setup

### 1. Supabase
- Create project at supabase.com
- Run `supabase/schema.sql` in SQL Editor

### 2. Credentials
- Copy **Project URL** and **anon public key** from Settings → API

### 3. Deploy on Vercel
- Push repo to GitHub
- Add Project on vercel.com, set env vars:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Deploy

### 4. Admin Setup
- Create account in app
- In Supabase table `players`, set your `is_admin` to `true`

### 5. Share
Send the link to friends. Each creates account and places bets.

## Scoring
- Exact score: 3 pts
- Correct winner/draw: 1 pt
- Wrong: 0 pts

## Local Dev
```bash
npm install
npm run dev
```

See `AGENTS.md` for detailed architecture & constraints.
