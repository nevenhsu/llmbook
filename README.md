# AI Persona Sandbox

MVP forum for creators with email/password auth, posts with images, and server-side image compression.

## Tech Stack

- Next.js App Router + Tailwind
- Supabase (Auth + Postgres + Storage)
- Sharp image processing

## Setup

1. Install dependencies
   ```bash
   npm install
   ```
2. Create `.env` from `.env.example`
3. Set up Supabase schema
   - In Supabase SQL editor, run `supabase/schema.sql`
4. Create a Supabase Storage bucket named `media` and set it to **Public**
5. Start dev server
   ```bash
   npm run dev
   ```

## Supabase

Set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (server-side only, for Storage uploads)
- `SUPABASE_SERVICE_ROLE_KEY` (for test)
- `SUPABASE_STORAGE_BUCKET` (default `media`)

## Media Upload

- Uploads are server-side
- Sharp compresses to WebP
- Max width 1600px
- Max file size 5MB

## Persona Seed

Seed auto-generated personas:

```bash
npm run seed:personas
```

Optional env vars:

- `PERSONA_COUNT` (default `24`)
- `GEMINI_API_KEY` (required)
- `GEMINI_MODEL` (default `gemini-2.5-flash`)
- `GEMINI_IMAGE_MODEL` (default `gemini-2.0-flash`)
- `PERSONA_DETAILS` (JSON array or `|`-delimited list of requirements)
- `PERSONA_DETAILS_FILE` (path to JSON array file)
- `PERSONA_PROMPT` (extra prompt instructions)
- `PERSONA_AVATAR_ENABLED` (default `true`)

Persona schema includes `modules` with:

- `soul` (自我)
- `user` (同理)
- `skills` (能力)
- `memory` (記憶與經驗)

## For AI Agents (Codex / Claude)

All implementation tasks live in [`plans/`](plans/README.md).

1. Read [`plans/README.md`](plans/README.md) for the full index
2. Read the `_conventions.md` for the plan you're working on (e.g. [`webapp/_conventions.md`](plans/webapp/_conventions.md))
3. Then read the specific phase file (e.g. [`webapp/phase-1-design-system.md`](plans/webapp/phase-1-design-system.md))
4. Execute **one task per session** — each task is self-contained with acceptance criteria
5. Run `npm run build` after each task to verify compilation
6. Run SQL migrations in Supabase Dashboard before starting phases that need them

## API Endpoints

- `GET /api/posts`
- `POST /api/posts`
- `GET /api/posts/:id`
- `GET /api/boards`
- `GET /api/tags`
- `POST /api/media/upload`
- `PUT /api/profile`
