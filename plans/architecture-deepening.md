# Architecture Deepening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deepen the AI-agent and admin architecture by extracting stable shared seams before behavior changes, so future work lands in smaller modules with narrower tests and less duplicated mapping/auth/lease logic.

**Architecture:** Use seam-first refactors that preserve existing public APIs until the last step of each slice. Every task starts with a characterization test, introduces one focused shared module or wrapper, migrates callers, then deletes duplicated logic only after focused suites pass. The plan also corrects one stale item from the original note: the client-side "7 hooks / 27 components" opportunity should be executed as inventory-backed action consolidation, not a blind hook explosion.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, Supabase read models/RPCs, AI-agent intake/orchestrator services, shared API helpers in `@/lib/api/fetch-json`

---

## Verified Current State

- `src/lib/ai/agent/intake/opportunity-pipeline-service.ts` is 1732 lines and currently mixes runtime orchestration, scoring, public-candidate routing, and admin-lab helper behavior.
- `src/lib/ai/agent/runtime-state-service.ts` is 769 lines and `src/lib/ai/agent/jobs/job-runtime-state-service.ts` is 349 lines; both already implement nearly the same lease lifecycle with separate row shapes.
- Task-snapshot row-to-view mapping is duplicated in four producers today: `persona-task-store.ts`, `memory-read-model.ts`, `task-table-read-model.ts`, and `task-injection-service.ts`.
- 36 admin AI route files still use `withAuth(...)` plus inline `isAdmin(user.id)` checks.
- `src/components/admin/agent-lab/lab-data.ts` is still component-local even though it depends on runtime intake contracts and is already tested as pure data shaping.
- The original client-hook opportunity is stale as written. Current code already reuses `useVote`, `use-post-interactions`, and `apiFetchJson` in several places, so the safe refactor is "finish action consolidation" with a verified caller inventory, not "create 7 hooks because the plan says so."

## Sequencing

1. Shared task snapshot mapper
2. `withAdminAuth` wrapper
3. Agent-lab pure data move
4. Shared runtime lease core
5. Intake pipeline split
6. Client action consolidation
7. Full verification and cleanup

## Task 1: Share The Task Snapshot Type And Mapper

**Files:**

- Create: `src/lib/ai/agent/read-models/task-snapshot.ts`
- Create: `src/lib/ai/agent/read-models/task-snapshot.test.ts`
- Modify: `src/lib/ai/agent/read-models/index.ts`
- Modify: `src/lib/ai/agent/read-models/overview-read-model.ts`
- Modify: `src/lib/ai/agent/execution/persona-task-store.ts`
- Modify: `src/lib/ai/agent/memory/memory-read-model.ts`
- Modify: `src/lib/ai/agent/operator-console/task-table-read-model.ts`
- Modify: `src/lib/ai/agent/intake/task-injection-service.ts`
- Modify: every import-only consumer listed in Appendix A
- Test: `src/lib/ai/agent/read-models/task-snapshot.test.ts`
- Test: `src/lib/ai/agent/operator-console/task-table-read-model.test.ts`
- Test: `src/lib/ai/agent/intake/task-injection-service.test.ts`

**Step 1: Write the failing shared-mapper test**

Create `src/lib/ai/agent/read-models/task-snapshot.test.ts` with one row fixture and one persona fixture that assert the normalized shape:

```ts
import { describe, expect, it } from "vitest";
import { mapTaskRow } from "./task-snapshot";

describe("task-snapshot", () => {
  it("maps persona_tasks rows into the shared snapshot shape", () => {
    expect(
      mapTaskRow(
        {
          id: "task-1",
          persona_id: "persona-1",
          task_type: "comment",
          dispatch_kind: "public",
          source_table: "posts",
          source_id: "post-1",
          dedupe_key: "dedupe-1",
          cooldown_until: null,
          payload: { summary: "hello" },
          status: "PENDING",
          scheduled_at: "2026-01-01T00:00:00.000Z",
          started_at: null,
          completed_at: null,
          retry_count: 0,
          max_retries: 3,
          lease_owner: null,
          lease_until: null,
          result_id: null,
          result_type: null,
          error_message: null,
          created_at: "2026-01-01T00:00:00.000Z",
        },
        { id: "persona-1", username: "ai_test", display_name: "Test" },
      ),
    ).toMatchObject({
      id: "task-1",
      personaId: "persona-1",
      personaUsername: "ai_test",
      taskType: "comment",
      dispatchKind: "public",
    });
  });
});
```

**Step 2: Run the new test to verify it fails**

Run: `pnpm vitest run src/lib/ai/agent/read-models/task-snapshot.test.ts`

Expected: FAIL because `task-snapshot.ts` and/or `mapTaskRow` do not exist yet.

**Step 3: Add the shared module**

Create `src/lib/ai/agent/read-models/task-snapshot.ts` and move the canonical task shape there:

```ts
import type { QueueTaskStatus } from "@/lib/ai/task-queue/task-queue";

export type TaskSnapshot = {
  id: string;
  personaId: string;
  personaUsername: string | null;
  personaDisplayName: string | null;
  taskType: string;
  dispatchKind: string;
  sourceTable: string | null;
  sourceId: string | null;
  dedupeKey: string | null;
  cooldownUntil: string | null;
  payload: Record<string, unknown>;
  status: QueueTaskStatus;
  scheduledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  retryCount: number;
  maxRetries: number;
  leaseOwner: string | null;
  leaseUntil: string | null;
  resultId: string | null;
  resultType: string | null;
  errorMessage: string | null;
  createdAt: string;
};

export type TaskSnapshotRow = {
  id: string;
  persona_id: string;
  task_type: string;
  dispatch_kind: string;
  source_table: string | null;
  source_id: string | null;
  dedupe_key: string | null;
  cooldown_until: string | null;
  payload: Record<string, unknown> | null;
  status: QueueTaskStatus;
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  retry_count: number;
  max_retries: number;
  lease_owner: string | null;
  lease_until: string | null;
  result_id: string | null;
  result_type: string | null;
  error_message: string | null;
  created_at: string;
};

export type TaskSnapshotPersonaRow = {
  id: string;
  username: string | null;
  display_name: string | null;
};

export function mapTaskRow(
  row: TaskSnapshotRow,
  persona: TaskSnapshotPersonaRow | null,
): TaskSnapshot {
  return {
    id: row.id,
    personaId: row.persona_id,
    personaUsername: persona?.username ?? null,
    personaDisplayName: persona?.display_name ?? null,
    taskType: row.task_type,
    dispatchKind: row.dispatch_kind,
    sourceTable: row.source_table,
    sourceId: row.source_id,
    dedupeKey: row.dedupe_key,
    cooldownUntil: row.cooldown_until,
    payload: row.payload ?? {},
    status: row.status,
    scheduledAt: row.scheduled_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    retryCount: row.retry_count,
    maxRetries: row.max_retries,
    leaseOwner: row.lease_owner,
    leaseUntil: row.lease_until,
    resultId: row.result_id,
    resultType: row.result_type,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}
```

**Step 4: Port producers, then flip imports**

- Re-export `TaskSnapshot` from `read-models/index.ts`.
- In `overview-read-model.ts`, import `TaskSnapshot` and `mapTaskRow`; remove the local `AiAgentRecentTaskSnapshot` object shape and local row-to-snapshot mapping.
- In `persona-task-store.ts`, `memory-read-model.ts`, `task-table-read-model.ts`, and `task-injection-service.ts`, delete local mapping functions and call `mapTaskRow(...)`.
- Update every import-only consumer in Appendix A from `AiAgentRecentTaskSnapshot` to `TaskSnapshot`.
- Keep `overview-read-model.ts` exporting `type AiAgentRecentTaskSnapshot = TaskSnapshot` as a temporary alias only if needed for a single pass; delete the alias before closing the task if all consumers are migrated cleanly.

**Step 5: Run focused verification**

Run: `pnpm vitest run src/lib/ai/agent/read-models/task-snapshot.test.ts src/lib/ai/agent/operator-console/task-table-read-model.test.ts src/lib/ai/agent/intake/task-injection-service.test.ts src/lib/ai/agent/execution/persona-task-generator.test.ts src/lib/ai/agent/execution/persona-task-persistence-service.test.ts`

Expected: PASS with no duplicated local mapper left in the four producers.

## Task 2: Replace Inline Admin Guards With `withAdminAuth`

**Files:**

- Modify: `src/lib/server/route-helpers.ts`
- Modify: `src/lib/server/route-helpers.test.ts`
- Modify: every route file listed in Appendix B
- Test: the touched route tests under `src/app/api/admin/ai/**/route.test.ts`

**Step 1: Write the failing helper test**

Add a `withAdminAuth` test to `src/lib/server/route-helpers.test.ts` that proves non-admin users get `403` and admin users reach the handler:

```ts
describe("withAdminAuth", () => {
  it("returns 403 for authenticated non-admin users", async () => {
    const response = await withAdminAuth(async () => http.ok({ ok: true }))(
      new Request("http://localhost"),
      { params: Promise.resolve({}) },
    );
    expect(response.status).toBe(403);
  });
});
```

**Step 2: Run the helper test to verify it fails**

Run: `pnpm vitest run src/lib/server/route-helpers.test.ts`

Expected: FAIL because `withAdminAuth` does not exist yet.

**Step 3: Implement the wrapper**

Add a new wrapper beside `withAuth`:

```ts
import { isAdmin } from "@/lib/admin";

export function withAdminAuth<TParams = unknown>(
  handler: (
    req: Request,
    ctx: AuthContext,
    routeContext: { params: Promise<TParams> },
  ) => Promise<NextResponse>,
): (req: Request, routeContext: { params: Promise<TParams> }) => Promise<NextResponse> {
  return withAuth(async (req, ctx, routeContext) => {
    if (!(await isAdmin(ctx.user.id))) {
      return http.forbidden("Forbidden - Admin access required");
    }
    return handler(req, ctx, routeContext);
  });
}
```

**Step 4: Migrate the admin routes**

- Replace `withAuth` with `withAdminAuth` in every route from Appendix B.
- Delete each inline `if (!(await isAdmin(user.id)))` block.
- Remove now-unused `isAdmin` imports from the route files.
- While touching mixed files such as `src/app/api/admin/ai/personas/route.ts`, make every exported handler under the admin namespace consistently use `withAdminAuth`, not only the ones that already had a manual check.

**Step 5: Run focused verification**

Run: `pnpm vitest run src/lib/server/route-helpers.test.ts $(rg --files src/app/api/admin/ai | rg 'route\\.test\\.ts$')`

Expected: PASS with no inline admin guard left in `src/app/api/admin/ai/**/route.ts`.

## Task 3: Move Agent-Lab Pure Data Mapping Into `src/lib`

**Files:**

- Create: `src/lib/ai/agent/intake/lab-types.ts`
- Create: `src/lib/ai/agent/intake/lab-data.ts`
- Create: `src/lib/ai/agent/intake/lab-data.test.ts`
- Modify: `src/lib/ai/agent/intake/index.ts`
- Modify: `src/components/admin/agent-lab/types.ts`
- Modify: `src/components/admin/agent-lab/AdminAiAgentLabClient.tsx`
- Modify: `src/components/admin/agent-lab/AiAgentLabSurface.tsx`
- Modify: `src/components/admin/agent-lab/PreviewAiAgentLabClient.tsx`
- Modify: `src/components/admin/agent-lab/lab-data.test.ts`
- Delete: `src/components/admin/agent-lab/lab-data.ts`

**Step 1: Copy the existing test to the destination and make it fail**

- Copy the current assertions from `src/components/admin/agent-lab/lab-data.test.ts` into `src/lib/ai/agent/intake/lab-data.test.ts`.
- Change imports to the new target path before the module exists.

Run: `pnpm vitest run src/lib/ai/agent/intake/lab-data.test.ts`

Expected: FAIL because `src/lib/ai/agent/intake/lab-data.ts` does not exist yet.

**Step 2: Split pure data types from component-only props**

- Move serializable agent-lab domain types (`AgentLabSourceMode`, `AgentLabPersonaGroup`, `AgentLabOpportunityRow`, `AgentLabCandidateRow`, `AgentLabTaskRow`, stage/result shapes) into `src/lib/ai/agent/intake/lab-types.ts`.
- Keep `AgentLabPageProps` in `src/components/admin/agent-lab/types.ts` because it is UI-facing and depends on callbacks/components.
- Update `types.ts` to import and re-export lib-owned types instead of defining them inline.

**Step 3: Move the pure builders**

- Move `buildInitialModes`, `buildSelectorStage`, `buildCandidateStage`, and `buildTaskSavePayloadData` into `src/lib/ai/agent/intake/lab-data.ts`.
- Keep the module free of React/component imports.
- Re-export the new module from `src/lib/ai/agent/intake/index.ts`.

**Step 4: Update component callers and test ownership**

- Point the three admin-lab components at `@/lib/ai/agent/intake/lab-data`.
- Move the long-form behavior test to the lib location and keep a tiny component-level smoke test only if a component still needs one.
- Delete the component-local `lab-data.ts` after all imports are migrated.

**Step 5: Run focused verification**

Run: `pnpm vitest run src/lib/ai/agent/intake/lab-data.test.ts src/app/api/admin/ai/agent/lab/source-mode/[kind]/route.test.ts src/app/api/admin/ai/agent/lab/save-task/route.test.ts`

Expected: PASS with agent-lab shaping living under `src/lib/ai/agent/intake/`.

## Task 4: Extract A Shared Runtime Lease Core

**Files:**

- Create: `src/lib/ai/agent/runtime-lease.ts`
- Create: `src/lib/ai/agent/runtime-lease.test.ts`
- Modify: `src/lib/ai/agent/runtime-state-service.ts`
- Modify: `src/lib/ai/agent/jobs/job-runtime-state-service.ts`
- Modify: `src/lib/ai/agent/read-models/overview-read-model.ts`
- Modify: `src/lib/ai/agent/operator-console/runtime-read-model.ts`
- Modify: `src/lib/ai/agent/operator-console/runtime-control.ts`
- Modify: `src/lib/ai/agent/operator-console/jobs-runtime-control.ts`
- Test: `src/lib/ai/agent/runtime-state-service.test.ts`
- Test: add a focused test for `job-runtime-state-service.ts` if one does not exist yet

**Step 1: Write failing pure-function tests**

Create `src/lib/ai/agent/runtime-lease.test.ts` that covers the shared cases:

```ts
describe("runtime-lease", () => {
  it("blocks when another owner holds an active lease", () => {
    expect(
      claimLease(
        {
          paused: false,
          leaseOwner: "other",
          leaseUntil: "2026-01-01T00:05:00.000Z",
          cooldownUntil: null,
        },
        { leaseOwner: "me", leaseMs: 60_000, now: new Date("2026-01-01T00:00:00.000Z") },
      ).result,
    ).toBe("blocked");
  });
});
```

Run: `pnpm vitest run src/lib/ai/agent/runtime-lease.test.ts`

Expected: FAIL because the shared lease module does not exist yet.

**Step 2: Implement shared pure primitives**

Create `runtime-lease.ts` with small row-agnostic helpers:

```ts
export type LeaseCoreRow = {
  paused: boolean;
  leaseOwner: string | null;
  leaseUntil: string | null;
  cooldownUntil?: string | null;
};

export function claimLease(
  row: LeaseCoreRow | null,
  input: {
    leaseOwner: string;
    leaseMs: number;
    now: Date;
    allowDuringCooldown?: boolean;
  },
): { result: "claimed" | "blocked"; nextLeaseUntil: string | null; reason?: string } {
  // shared paused / other-owner / cooldown checks only
}
```

The shared module should cover:

- lease timestamp math
- other-owner blocking
- caller-owned heartbeat eligibility
- optional cooldown gating

It must not know about Supabase, manual Phase A fields, or runtime-key names.

**Step 3: Refactor the orchestrator runtime service to compose the core**

- Keep `AiAgentRuntimeStateService` public methods and response unions stable.
- Replace duplicated active-lease/cooldown math with calls into `runtime-lease.ts`.
- Keep orchestrator-only concerns in `runtime-state-service.ts`: manual Phase A fields, runtime-app online window, cooldown persistence, and snapshot detail strings.

**Step 4: Refactor the jobs runtime service to compose the same core**

- Replace local claim/heartbeat/release lease gating with the shared helpers.
- Keep jobs-only concerns in `job-runtime-state-service.ts`: `runtimeKey`, `job_runtime_state` row shape, and jobs-specific status labels.
- Add a focused jobs-runtime test file if none exists yet; do not rely on orchestrator tests to cover the second consumer.

**Step 5: Run focused verification**

Run: `pnpm vitest run src/lib/ai/agent/runtime-lease.test.ts src/lib/ai/agent/runtime-state-service.test.ts`

Expected: PASS and both runtime services still expose the same external API.

## Task 5: Split The Intake God Module Behind Stable Facades

**Files:**

- Create: `src/lib/ai/agent/intake/flows/IntakeFlow.ts`
- Create: `src/lib/ai/agent/intake/flows/NotificationPipeline.ts`
- Create: `src/lib/ai/agent/intake/flows/PublicPipeline.ts`
- Create: `src/lib/ai/agent/intake/opportunity-scorer.ts`
- Create: `src/lib/ai/agent/intake/intake-progress-event.ts`
- Modify: `src/lib/ai/agent/intake/opportunity-pipeline-service.ts`
- Modify: `src/lib/ai/agent/orchestrator/orchestrator-phase-service.ts`
- Modify: `src/lib/ai/agent/orchestrator/local-phase-a-runner-service.ts`
- Modify: `src/lib/ai/agent/intake/admin-lab-source-service.ts`
- Modify: `src/components/admin/agent-lab/AdminAiAgentLabClient.tsx`
- Modify: `src/app/api/admin/ai/agent/intake/[kind]/inject/route.ts`
- Modify: `src/app/api/admin/ai/agent/lab/opportunities/[kind]/route.ts`
- Modify: `src/app/api/admin/ai/agent/lab/candidates/public/route.ts`
- Test: `src/lib/ai/agent/intake/opportunity-pipeline-service.test.ts`
- Test: `src/app/api/admin/ai/agent/intake/[kind]/inject/route.test.ts`
- Test: `src/app/api/admin/ai/agent/lab/opportunities/[kind]/route.test.ts`
- Test: `src/app/api/admin/ai/agent/lab/candidates/public/route.test.ts`

**Step 1: Write failing flow-boundary tests**

Add focused assertions that the notification path and public path can be invoked independently:

```ts
it("routes notification execution through NotificationPipeline", async () => {
  const service = new AiAgentOpportunityPipelineService({
    deps: {
      /* spies */
    },
  });
  await service.executeFlow({ kind: "notification" });
  expect(notificationExecuteSpy).toHaveBeenCalled();
  expect(publicExecuteSpy).not.toHaveBeenCalled();
});
```

Run: `pnpm vitest run src/lib/ai/agent/intake/opportunity-pipeline-service.test.ts`

Expected: FAIL because the new flow seams do not exist yet.

**Step 2: Extract shared event and scoring infrastructure**

- Move `AiAgentOpportunityPipelineEvent` into `intake-progress-event.ts`.
- Move probability update batching and shared scoring helpers into `opportunity-scorer.ts`.
- Keep the event payloads stable so `local-phase-a-runner-service.ts` logging does not change shape.

**Step 3: Extract the two concrete flows**

Create a small interface:

```ts
export interface IntakeFlow<TResult> {
  execute(): Promise<TResult>;
}
```

Then split the logic:

- `NotificationPipeline` owns notification snapshot ingest, scoring scope, selected-row loading, auto-routing, and processed-opportunity marking.
- `PublicPipeline` owns public snapshot ingest, scoring scope, reference-batch lookup, speaker selection, candidate recording, and runtime cursor advancement.

**Step 4: Keep `AiAgentOpportunityPipelineService` as a compatibility facade during migration**

- Do not delete the existing class immediately.
- Convert it into a dispatcher/composer that builds `NotificationPipeline` and `PublicPipeline`.
- Keep existing public methods such as `executeFlow(...)` stable while the routes/admin-lab callers migrate.
- Update `orchestrator-phase-service.ts` and `local-phase-a-runner-service.ts` to depend on the extracted flow/event modules rather than the god module internals.

**Step 5: Run focused verification**

Run: `pnpm vitest run src/lib/ai/agent/intake/opportunity-pipeline-service.test.ts src/app/api/admin/ai/agent/intake/[kind]/inject/route.test.ts src/app/api/admin/ai/agent/lab/opportunities/[kind]/route.test.ts src/app/api/admin/ai/agent/lab/candidates/public/route.test.ts src/lib/ai/agent/intake/lab-data.test.ts`

Expected: PASS with both flows testable in isolation and no behavior drift at the route boundary.

## Task 6: Replace The Stale "7 Hooks" Idea With Inventory-Backed Client Action Consolidation

**Files:**

- Modify: `src/hooks/use-post-interactions.ts`
- Create as needed: focused hooks only where stateful logic repeats after inspection
- Modify: `src/components/notification/NotificationList.tsx`
- Modify: `src/components/post/PollDisplay.tsx`
- Modify: `src/components/feed/FeedContainer.tsx`
- Modify: `src/components/profile/ProfilePostList.tsx`
- Modify: `src/components/board/settings/ModeratorsSettingsTab.tsx`
- Modify: `src/components/ui/EntityUsernameInput.tsx`
- Modify: any additional caller from Appendix C that still uses raw `fetch()` for domain actions after the first pass

**Step 1: Lock the inventory with a characterization test or grep gate**

Before refactoring behavior, record the current raw-action caller set:

Run: `rg -n "fetch\\(|api(Post|Patch|Delete)|votePost|voteComment" src/components src/hooks`

Expected: the output should still include the files listed in Appendix C.

If the inventory already changed on another branch, update the plan before implementing this task.

**Step 2: Normalize the lowest-risk API callers first**

- Convert `NotificationList.tsx`, `PollDisplay.tsx`, `FeedContainer.tsx`, and `ProfilePostList.tsx` from raw `fetch()` + local `res.ok` branches to `apiFetchJson`/`apiPatch`/`apiDelete`.
- Extend `use-post-interactions.ts` to use the shared API helper layer instead of raw `fetch()`.
- Do not create a new hook unless at least two callers share the same stateful action logic after the helper conversion.

**Step 3: Extract only the hooks that are justified by duplicated stateful behavior**

Concrete first candidates, only if duplication remains after Step 2:

- `use-notification-actions.ts` for `NotificationBell.tsx` + `NotificationList.tsx`
- `use-search-actions.ts` for `SearchBar.tsx` + `MobileSearchOverlay.tsx`
- `use-comment-vote-actions.ts` only if `CommentItem.tsx` and `ProfilePostList.tsx` still duplicate the same composition around `useVote`

Reject the old broad "7 hooks" plan if a slice would only wrap a single caller.

**Step 4: Re-run the inventory and shrink it**

Run: `rg -n "fetch\\(" src/components src/hooks`

Expected: only intentional binary/file-upload callers remain, such as multipart uploads in `usePostForm.ts`, plus any caller that cannot move to `fetch-json` because it depends on `Response` streaming or status-code branching.

**Step 5: Run focused verification**

Run: `pnpm vitest run src/components/comment/CommentItem.test.ts src/components/post/PostRow.test.ts src/components/ui/PersonaSelector.test.ts`

Expected: PASS, plus manual grep proof that the remaining raw `fetch()` callers are intentional rather than accidental drift.

## Task 7: Final Verification And Cleanup

**Files:**

- Modify: any touched file from Tasks 1-6
- Modify: `plans/architecture-deepening.md` if implementation discoveries force a real scope correction

**Step 1: Run the stable repo gate**

Run: `npm run test:core`

Expected: PASS.

**Step 2: Run the full handoff verification gate**

Run: `npm run verify`

Expected: PASS (`typecheck`, `lint`, and `test:llm-flows`).

**Step 3: Remove transitional compatibility shims**

- Delete any temporary alias such as `type AiAgentRecentTaskSnapshot = TaskSnapshot` once consumers are migrated.
- Delete any dead compatibility wrappers left behind during the intake split.
- Re-run grep checks used in the earlier tasks to prove the duplication is actually gone.

**Step 4: Update this plan if reality diverges**

If a task uncovers a materially different live constraint, edit this plan in place before continuing. Do not keep executing against a stale plan.

## Appendix A: Task Snapshot Consumer Inventory

These files currently reference `AiAgentRecentTaskSnapshot` and should be touched or reviewed during Task 1:

- `src/lib/ai/agent/execution/execution-preview.ts`
- `src/lib/ai/agent/execution/flows/comment-flow-module.test.ts`
- `src/lib/ai/agent/execution/flows/post-flow-module.test.ts`
- `src/lib/ai/agent/execution/flows/reply-flow-module.test.ts`
- `src/lib/ai/agent/execution/flows/types.ts`
- `src/lib/ai/agent/execution/media-job-service.ts`
- `src/lib/ai/agent/execution/persona-interaction-service.ts`
- `src/lib/ai/agent/execution/persona-task-context-builder.test.ts`
- `src/lib/ai/agent/execution/persona-task-context-builder.ts`
- `src/lib/ai/agent/execution/persona-task-executor.ts`
- `src/lib/ai/agent/execution/persona-task-generator.test.ts`
- `src/lib/ai/agent/execution/persona-task-generator.ts`
- `src/lib/ai/agent/execution/persona-task-persistence-service.test.ts`
- `src/lib/ai/agent/execution/persona-task-persistence-service.ts`
- `src/lib/ai/agent/execution/persona-task-store.ts`
- `src/lib/ai/agent/execution/text-lane-service.ts`
- `src/lib/ai/agent/execution/text-runtime-service.ts`
- `src/lib/ai/agent/intake/task-injection-service.ts`
- `src/lib/ai/agent/memory/memory-lineage.ts`
- `src/lib/ai/agent/memory/memory-preview.ts`
- `src/lib/ai/agent/memory/memory-read-model.ts`
- `src/lib/ai/agent/operator-console/task-table-read-model.test.ts`
- `src/lib/ai/agent/operator-console/task-table-read-model.ts`
- `src/lib/ai/agent/read-models/overview-read-model.ts`
- `src/lib/ai/agent/tasks/queue-action-preview.ts`
- `src/lib/ai/agent/tasks/queue-action-service.test.ts`
- `src/lib/ai/agent/tasks/queue-action-service.ts`

## Appendix B: Admin Route Inventory For `withAdminAuth`

- `src/app/api/admin/ai/agent/intake/[kind]/inject/route.ts`
- `src/app/api/admin/ai/agent/lab/candidates/public/route.ts`
- `src/app/api/admin/ai/agent/lab/opportunities/[kind]/route.ts`
- `src/app/api/admin/ai/agent/lab/save-task/route.ts`
- `src/app/api/admin/ai/agent/lab/source-mode/[kind]/route.ts`
- `src/app/api/admin/ai/agent/media/jobs/[id]/actions/route.ts`
- `src/app/api/admin/ai/agent/media/jobs/[id]/route.ts`
- `src/app/api/admin/ai/agent/media/jobs/route.ts`
- `src/app/api/admin/ai/agent/memory/personas/[id]/compress/route.ts`
- `src/app/api/admin/ai/agent/memory/personas/[id]/compression-batch-preview/route.ts`
- `src/app/api/admin/ai/agent/memory/personas/[id]/latest-write-preview/route.ts`
- `src/app/api/admin/ai/agent/memory/personas/[id]/persist-latest-write/route.ts`
- `src/app/api/admin/ai/agent/memory/personas/[id]/preview-compression/route.ts`
- `src/app/api/admin/ai/agent/memory/personas/[id]/route.ts`
- `src/app/api/admin/ai/agent/panel/images/route.ts`
- `src/app/api/admin/ai/agent/panel/jobs/route.ts`
- `src/app/api/admin/ai/agent/panel/jobs/runtime/[action]/route.ts`
- `src/app/api/admin/ai/agent/panel/memory/route.ts`
- `src/app/api/admin/ai/agent/panel/runtime/[action]/route.ts`
- `src/app/api/admin/ai/agent/panel/runtime/route.ts`
- `src/app/api/admin/ai/agent/panel/tasks/[kind]/route.ts`
- `src/app/api/admin/ai/agent/runtime/[action]/route.ts`
- `src/app/api/admin/ai/agent/tasks/[id]/actions/route.ts`
- `src/app/api/admin/ai/control-plane/route.ts`
- `src/app/api/admin/ai/models/[id]/test/route.ts`
- `src/app/api/admin/ai/models/route.ts`
- `src/app/api/admin/ai/persona-generation/preview/route.ts`
- `src/app/api/admin/ai/persona-generation/prompt-assist/route.ts`
- `src/app/api/admin/ai/persona-interaction/context-assist/route.ts`
- `src/app/api/admin/ai/persona-interaction/preview/route.ts`
- `src/app/api/admin/ai/persona-references/check/route.ts`
- `src/app/api/admin/ai/personas/[id]/route.ts`
- `src/app/api/admin/ai/personas/route.ts`
- `src/app/api/admin/ai/policy-releases/[version]/rollback/route.ts`
- `src/app/api/admin/ai/policy-releases/route.ts`
- `src/app/api/admin/ai/providers/route.ts`

## Appendix C: Verified Client Action Consolidation Inventory

These are the current live callers that justify Task 6:

- `src/hooks/use-post-interactions.ts`
- `src/components/notification/NotificationList.tsx`
- `src/components/post/PollDisplay.tsx`
- `src/components/feed/FeedContainer.tsx`
- `src/components/profile/ProfilePostList.tsx`
- `src/components/board/settings/ModeratorsSettingsTab.tsx`
- `src/components/ui/EntityUsernameInput.tsx`
- `src/components/create-post/hooks/usePostForm.ts`
- `src/components/profile/FollowButton.tsx`
- `src/components/board/JoinButton.tsx`
- `src/components/board/BoardLayout.tsx`

Intentional exclusions from the first pass:

- `src/components/create-post/hooks/usePostForm.ts` multipart upload path should stay raw `fetch()` unless the shared helper gains binary upload support.
- `src/components/profile/FollowButton.tsx`, `src/components/board/JoinButton.tsx`, and `src/components/board/BoardLayout.tsx` can be deferred if Task 6 already removes the highest-value drift from notifications, polls, feed/profile loaders, and search/moderator lookup.
