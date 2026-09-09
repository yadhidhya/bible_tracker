# Netlify + Supabase deployment

## 1. Supabase
Run `supabase_setup.sql` in Supabase SQL Editor.

## 2. Local environment
Create a `.env` file:

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

## 3. Install and build

```bash
npm install
npm run build
```

## 4. Netlify
Connect this project/repository to Netlify.

Build command:

```text
npm run build
```

Publish directory:

```text
dist
```

Add these Netlify environment variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

## 5. Supabase Auth URL
After Netlify gives you your site URL, go to:

Authentication -> URL Configuration

Set the Site URL to the Netlify URL and add the Netlify URL to Redirect URLs.
