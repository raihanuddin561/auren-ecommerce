# Production environment (Vercel, Supabase, Vercel Blob)

The app refuses to start in production when a required value is missing or unsafe
(`src/lib/env/production.ts`). Set these in Vercel, Project Settings, Environment Variables
(Production scope; Preview gets its own database and Blob store, never production's).

| Variable | Value | Notes |
|---|---|---|
| `APP_URL`, `NEXT_PUBLIC_APP_URL` | the public https URL | must be equal |
| `DATABASE_URL` | Supabase **transaction pooler**, port 6543, as `auren_app.<project-ref>`, `?sslmode=require` | runtime only |
| `DIRECT_URL` | Supabase **direct or session** connection, port 5432, as `auren_migrator`, `?sslmode=require` | migrations only; must differ from `DATABASE_URL` |
| `DB_POOL_MAX` | `5` to `10` | the pooler multiplexes connections |
| `BLOB_READ_WRITE_TOKEN` | from Vercel, Storage, your Blob store, `.env.local` tab | required; the store hosts public product images and private receipts |
| `BETTER_AUTH_SECRET` (and `BETTER_AUTH_SECRETS` when rotating) | `openssl rand -base64 32` | also signs private media links |
| Upstash, Inngest, Resend, Turnstile, Sentry | see `.env.example` | Upstash and both Inngest keys are required |

Never set `MEDIA_LOCAL_DIR` in production (the local media route answers 404 there), and never add
the Supabase `anon`, `authenticated` or `service_role` keys: the application does not use the Data
API (see `docs/runbooks/database-roles.md`, section Supabase).

## Vercel Blob

1. Vercel, Storage, Create, Blob. One store per environment (production, preview).
2. Connect it to the project; Vercel adds `BLOB_READ_WRITE_TOKEN`.
3. Public product images are served from `https://<store-id>.public.blob.vercel-storage.com`; the CSP `img-src` already allows exactly that pattern. Receipts and invoices are written as private blobs and are only ever delivered through short-lived signed links from this app.

## Cloudinary

Cloudinary is no longer used (ADR-026). Delete `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` from every environment, including your local `.env.local`, and rotate the API secret if it was ever shared.
