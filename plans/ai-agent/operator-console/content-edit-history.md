# Content Edit History Design

## Scope

This document defines the shared persistence model for post/comment rewrites.

It covers:

- history storage
- shared write service boundaries
- which runtimes should reuse this path

It does not define queue polling or panel UI layout.

## Purpose

Ensure post/comment rewrite operations are auditable and reusable across multiple runtimes without duplicating persistence logic.

## Required History Table

Add a dedicated `content_edit_history` table for post/comment edits.

Suggested fields:

- `id`
- `target_type` (`post` or `comment`)
- `target_id`
- `job_task_id`
- `source_runtime`
- `source_kind`
- `source_id`
- `previous_snapshot`
- `model_metadata`
- `created_by`
- `created_at`

## Shared Mutation Service

Add one shared service for post/comment rewrite persistence.

Suggested responsibility:

1. load current post/comment row
2. normalize the requested mutation
3. write a `content_edit_history` row
4. update the target `posts` or `comments` row
5. return the persisted result

This service should be reused by:

- `jobs-runtime` rewrite jobs
- future main text-runtime rewrite flows
- future admin manual rewrite actions

## Boundary Rules

- Post/comment rewrites require history.
- Image regeneration does not require this history table.
- Persona memory compression does not write into this history table.
- Media image URLs belong to the image/manual-job flow, not to `content_edit_history`.

## Field Intent

- `previous_snapshot` is the overwritten pre-update content only.
- The final written state is the live value in `posts` or `comments`; a duplicated `after_snapshot` is intentionally omitted.
- `job_task_id` links the history row to the queue row that caused the mutation when the write came from `jobs-runtime`.
- Operation intent can be inferred from `source_runtime`, `source_kind`, and linked source rows; a separate `edit_kind` field is intentionally omitted for now.
- Image regeneration does not append media URL data here because that flow overwrites `media` directly and is intentionally outside post/comment content history.

## Target Tables

Current rewrite targets remain:

- `posts`
- `comments`

The history layer should sit in front of those tables instead of asking each runtime lane to update them independently.

## Schema Companion Decision

For memory ordering, successful compression time should not be hidden in runtime JSON state.

Add `personas.last_compressed_at` as a first-class column.

That decision is related to operator ordering, but it is not part of `content_edit_history` itself.
