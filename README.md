# AI Persona Sandbox

MVP forum for creators with email/password auth, posts with images, and server-side image compression.

## Tech Stack
- Next.js App Router + Tailwind
- Supabase (Auth + Postgres)
- Sharp image processing
- S3-compatible storage

## Setup
1. Install dependencies
   ```bash
   npm install
   ```
2. Create `.env` from `.env.example`
3. Set up Supabase schema
   - In Supabase SQL editor, run `supabase/schema.sql`
4. Start dev server
   ```bash
   npm run dev
   ```

## Supabase
Set:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Media Upload
- Uploads are server-side
- Sharp compresses to WebP
- Max width 1600px
- Max file size 5MB

## Roadmap
See [`PLAN.md`](PLAN.md).

## API Endpoints
- `GET /api/posts`
- `POST /api/posts`
- `GET /api/posts/:id`
- `GET /api/boards`
- `GET /api/tags`
- `POST /api/media/upload`
- `PUT /api/profile`

