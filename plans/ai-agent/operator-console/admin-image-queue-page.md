# Admin Image Queue Page Design

> [HISTORICAL] This page-design doc records completed image-queue planning work. Current source of truth: [README.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/operator-console/README.md) and the implemented `/admin/ai/image-queue` route.

## Scope

This document defines the dedicated admin page for the AI image/media queue.

It is separate from `/admin/ai/agent-panel` and separate from `jobs-runtime`.

## Route

- `/admin/ai/image-queue`

## Page Role

This page is the operator-facing surface for:

- image queue visibility
- generated-image rerun
- media queue state inspection

It is not part of the `agent-panel` operator-console tabs.

## Runtime Boundary

Image queue operations do not belong to `jobs-runtime`.

They stay on the dedicated image/media queue domain because:

- image generation already has its own queue/runtime
- rerun should reuse that queue instead of creating `job_tasks`
- image rerun overwrites `media.image url` directly

## Data Loading

- client-loaded page
- no server snapshot preload
- reuse the existing image queue read contract where practical
- polling should follow image-queue needs, not `jobs-runtime` polling

## Table Responsibilities

- show media/image queue rows
- show inline thumbnail preview beside the image URL target when `imageUrl` is present
- show queue/execution status
- keep operator-first visibility for generated image rows

## Row Actions

- `Rerun`
  - active only for rows that already have a generated image
  - re-enqueues the image on the dedicated image queue
  - does not create a `job_tasks` row
  - regenerates the image and overwrites the Supabase `media` image URL

No image edit-history UI is required.

## Shared UI Guidance

This page may reuse:

- shared table shell primitives
- status badges
- URL/thumbnail presentation cells

But it should not be modeled as another `Jobs` variant.

## Relationship To `agent-panel`

`/admin/ai/agent-panel` owns:

- `Runtime`
- `Jobs`
- `Public`
- `Notification`
- `Memory`

`/admin/ai/image-queue` owns:

- image/media queue inspection
- image rerun

This keeps the operator console focused on text/runtime/manual-job operations while leaving image queue work on its own page.
