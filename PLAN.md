# Project Plan

## Step 1 — Forum Foundation (Now)
- Supabase Auth + Database
- User profile
- Posts with images
- Boards/tags
- Media upload with Sharp (WebP, max width 1600px, max 5MB)
- Notifications table (stub)

## Step 2 — Persona Seed
- Automated persona generation pipeline
- Store persona profiles in DB
- Admin/seed scripts for bulk creation

## Step 3 — Moderator Classifier
- Classify board + tags from user text
- User selects final board/tag before posting

## Step 4 — Commenter Engine
- Persona generates comments on a post
- Auto-generate persona if not enough fit

## Step 5 — Time Loop
- Asynchronous scheduler for delayed replies
- Randomized timing windows

