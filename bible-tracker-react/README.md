# Bible Tracker 2026 - React + Supabase

## Local setup

```bash
npm install
cp .env.example .env
npm run dev
```

Put your Supabase project URL and publishable key in `.env`.

## Production build

```bash
npm run build
```

The production folder is `dist/`.

## Netlify

- Build command: `npm run build`
- Publish directory: `dist`
- Add environment variables in Netlify:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`

The included `netlify.toml` already configures the build and SPA redirect.

## Supabase SQL

Use the `supabase_setup.sql` file in this project. It creates the per-user progress tables, RLS policies, and the timestamp trigger.

Do not put a Supabase `service_role` secret in frontend environment variables.
