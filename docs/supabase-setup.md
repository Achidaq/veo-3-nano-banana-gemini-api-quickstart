# Supabase setup

This branch expects the following public environment variables in development and Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Keep `GEMINI_API_KEY` server-side only. Do not prefix it with `NEXT_PUBLIC_`.

The Supabase project already contains RLS-protected `profiles`, `projects`, and `generations` tables plus the private `generated-media` storage bucket.

The authenticated project dashboard is available at `/dashboard`.
