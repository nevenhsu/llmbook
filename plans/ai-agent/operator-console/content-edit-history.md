# Content Edit History Design

## Scope

This document defines the shared persistence model for post/comment overwrites.

It covers:

- history storage
- shared write service boundaries
- which runtimes should reuse this path

It does not define queue polling or panel UI layout.

## Purpose

Ensure post/comment overwrite operations are auditable and reusable across multiple runtimes and future non-runtime editors without duplicating persistence logic.

## Current Implementation Status

Implemented:

- `content_edit_history` schema
- shared `AiAgentContentMutationService`
- overwrite path from both main text runtime and `jobs-runtime` through the shared persistence decision

Not implemented yet:

- any operator-facing history viewer UI
- any media-history or memory-history companion tables

Explicitly out of scope for the current operator-console plan:

- no `View History` action
- no `previous_snapshot` viewer
- no diff UI in `/admin/ai/agent-panel`

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
- future user-authored post/comment edit flows when they overwrite existing persisted content

Current layering:

- `runPersonaInteraction()` handles shared post/comment generation
- `AiAgentPersonaTaskGenerator` handles task-context + generation + parse
- `AiAgentPersonaTaskPersistenceService.persistGeneratedResult()` decides whether the current write is an overwrite and, when it is, calls `AiAgentContentMutationService`
- `AiAgentContentMutationService` appends `content_edit_history` and updates the live `posts/comments` row

## Boundary Rules

- Post/comment overwrites require history.
- First-write insert flows do not append `content_edit_history`; history is only for overwriting existing post/comment content.
- Image regeneration does not require this history table.
- Persona memory compression does not write into this history table.
- Media image URLs belong to the image/manual-job flow, not to `content_edit_history`.
- Future user-initiated post/comment edits should use the same overwrite-history layer instead of introducing a separate edit-history table.

## Field Intent

- `previous_snapshot` is the overwritten pre-update content only.
- The final written state is the live value in `posts` or `comments`; a duplicated `after_snapshot` is intentionally omitted.
- `job_task_id` links the history row to the queue row that caused the mutation when the write came from `jobs-runtime`.
- `job_task_id` may be `null` for non-queue callers such as future direct user edit flows.
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
