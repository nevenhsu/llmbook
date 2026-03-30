"use client";

import { useRef, useState } from "react";
import { JsonPreviewCard } from "@/components/ui/JsonPreviewCard";
import { SectionCard } from "@/components/admin/control-plane/SectionCard";
import { PreviewPanel } from "@/components/admin/control-plane/PreviewPanel";
import AiAgentPanel from "@/components/admin/agent-panel/AiAgentPanel";
import { ResolvedPersonaPreviewCard } from "@/components/admin/agent-panel/ResolvedPersonaPreviewCard";
import {
  buildExecutionPreview,
  buildResolvedPersonasPreview,
  buildSelectorInputPreview,
  buildSelectorOutputPreview,
  buildTaskCandidatePreview,
  buildTaskInjectionPreview,
  buildTaskWritePreview,
  type AiAgentExecutionPreview,
  type AiAgentRuntimeSourceSnapshot,
  type IntakeFixtureMode,
  type IntakeOpportunityFixture,
  type ResolvedPersonaPreview,
  type SelectorInputPreview,
  type SelectorOutputPreview,
  type TaskCandidatePreview,
  type TaskInjectionPreview,
  type TaskWritePreview,
} from "@/lib/ai/agent";
import type { AiAgentOverviewSnapshot } from "@/lib/ai/agent/read-models/overview-read-model";

const FIXTURE_OPTIONS: Array<{
  value: IntakeFixtureMode;
  label: string;
  items: IntakeOpportunityFixture[];
}> = [
  {
    value: "mixed-public-opportunity",
    label: "Mixed Public Opportunity",
    items: [
      {
        source: "public-post",
        contentType: "post",
        summary: "High-engagement board thread with two comment opportunities.",
      },
      {
        source: "public-comment",
        contentType: "comment",
        summary: "Fresh comment chain with persona-relevant hooks.",
      },
    ],
  },
  {
    value: "notification-intake",
    label: "Notification Intake",
    items: [
      {
        source: "notification",
        contentType: "mention",
        summary: "Unread mention that should route through notification triage.",
      },
      {
        source: "notification",
        contentType: "reply",
        summary: "Reply notification that should surface a comment candidate.",
      },
    ],
  },
];

export default function AiAgentLabPage({
  initialSnapshot,
  runtimePreviews,
}: {
  initialSnapshot: AiAgentOverviewSnapshot;
  runtimePreviews?: {
    notification: AiAgentRuntimeSourceSnapshot;
    public: AiAgentRuntimeSourceSnapshot;
  } | null;
}) {
  const [fixtureMode, setFixtureMode] = useState<
    IntakeFixtureMode | "runtime-notification" | "runtime-public"
  >("mixed-public-opportunity");
  const groupIndexOverrideRef = useRef<HTMLInputElement>(null);
  const [selectorInput, setSelectorInput] = useState<SelectorInputPreview | null>(null);
  const [selectorOutput, setSelectorOutput] = useState<SelectorOutputPreview | null>(null);
  const [resolvedPersonas, setResolvedPersonas] = useState<ResolvedPersonaPreview[] | null>(null);
  const [taskCandidates, setTaskCandidates] = useState<TaskCandidatePreview[] | null>(null);
  const [taskWritePreview, setTaskWritePreview] = useState<TaskWritePreview[] | null>(null);
  const [taskInjectionPreview, setTaskInjectionPreview] = useState<TaskInjectionPreview | null>(
    null,
  );
  const [executionPreview, setExecutionPreview] = useState<AiAgentExecutionPreview | null>(null);

  const fixture =
    FIXTURE_OPTIONS.find((option) => option.value === fixtureMode) ?? FIXTURE_OPTIONS[0];
  const activeRuntimePreview =
    fixtureMode === "runtime-notification"
      ? (runtimePreviews?.notification ?? null)
      : fixtureMode === "runtime-public"
        ? (runtimePreviews?.public ?? null)
        : null;

  const generateSelectorInput = () => {
    if (activeRuntimePreview?.selectorInput) {
      setSelectorInput(activeRuntimePreview.selectorInput);
      setSelectorOutput(null);
      setResolvedPersonas(null);
      setTaskCandidates(null);
      setTaskWritePreview(null);
      setTaskInjectionPreview(null);
      setExecutionPreview(null);
      return activeRuntimePreview.selectorInput;
    }

    const next = buildSelectorInputPreview({
      fixtureMode:
        fixtureMode === "notification-intake" ? "notification-intake" : "mixed-public-opportunity",
      groupIndexOverride: Math.max(
        0,
        Number.parseInt(groupIndexOverrideRef.current?.value ?? "1", 10) || 0,
      ),
      selectorReferenceBatchSize: initialSnapshot.config.values.selectorReferenceBatchSize,
      items: fixture.items,
    });
    setSelectorInput(next);
    setSelectorOutput(null);
    setResolvedPersonas(null);
    setTaskCandidates(null);
    setTaskWritePreview(null);
    setTaskInjectionPreview(null);
    setExecutionPreview(null);
    return next;
  };

  const generateSelectorOutput = () => {
    const nextInput = selectorInput ?? generateSelectorInput();
    const nextOutput = buildSelectorOutputPreview(nextInput);
    setSelectorOutput(nextOutput);
    setResolvedPersonas(null);
    setTaskCandidates(null);
    setTaskWritePreview(null);
    setTaskInjectionPreview(null);
    setExecutionPreview(null);
    return nextOutput;
  };

  const generateResolvedPersonas = () => {
    const nextOutput = selectorOutput ?? generateSelectorOutput();
    const nextResolved = buildResolvedPersonasPreview(nextOutput);
    setResolvedPersonas(nextResolved);
    setTaskCandidates(null);
    setTaskWritePreview(null);
    setTaskInjectionPreview(null);
    setExecutionPreview(null);
    return nextResolved;
  };

  const generateTaskCandidates = () => {
    const nextInput = selectorInput ?? generateSelectorInput();
    const nextResolved = resolvedPersonas ?? generateResolvedPersonas();
    const nextCandidates = buildTaskCandidatePreview({
      selectorInput: nextInput,
      resolvedPersonas: nextResolved,
    });
    setTaskCandidates(nextCandidates);
    const nextTaskWritePreview = buildTaskWritePreview(nextCandidates);
    setTaskWritePreview(nextTaskWritePreview);
    setTaskInjectionPreview(
      buildTaskInjectionPreview({
        candidates: nextCandidates,
        taskWritePreview: nextTaskWritePreview,
      }),
    );
    setExecutionPreview(null);
    return {
      nextInput,
      nextResolved,
      nextCandidates,
      nextTaskWritePreview,
    };
  };

  const generateExecutionPreview = () => {
    const generated =
      taskCandidates && taskWritePreview && selectorInput && resolvedPersonas
        ? {
            nextInput: selectorInput,
            nextResolved: resolvedPersonas,
            nextCandidates: taskCandidates,
            nextTaskWritePreview: taskWritePreview,
          }
        : generateTaskCandidates();
    const nextExecutionPreview = buildExecutionPreview({
      selectorInput: generated.nextInput,
      resolvedPersonas: generated.nextResolved,
      candidates: generated.nextCandidates,
      taskWritePreview: generated.nextTaskWritePreview,
    });
    setExecutionPreview(nextExecutionPreview);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div className="space-y-2">
        <p className="text-base-content/50 text-sm font-semibold tracking-[0.24em] uppercase">
          Preview
        </p>
        <h1 className="text-base-content text-3xl font-semibold">AI Agent Lab</h1>
        <p className="text-base-content/70 max-w-3xl text-sm">
          Fixture-backed dev surface for validating intake shape and section wiring before the
          shared selector and candidate preview builders land.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard title="Lab Controls">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="form-control gap-2">
              <span className="text-base-content/60 text-xs font-semibold tracking-wide uppercase">
                Fixture Mode
              </span>
              <select
                className="select select-bordered"
                value={fixtureMode}
                onChange={(event) =>
                  setFixtureMode(
                    event.target.value as
                      | IntakeFixtureMode
                      | "runtime-notification"
                      | "runtime-public",
                  )
                }
              >
                {FIXTURE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
                <option value="runtime-notification">Runtime Notification Snapshot</option>
                <option value="runtime-public">Runtime Public Snapshot</option>
              </select>
            </label>
            <label className="form-control gap-2">
              <span className="text-base-content/60 text-xs font-semibold tracking-wide uppercase">
                Group Index Override
              </span>
              <input
                ref={groupIndexOverrideRef}
                type="number"
                min={0}
                className="input input-bordered"
                defaultValue="1"
              />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="border-base-300 rounded-lg border px-4 py-3">
              <div className="text-base-content/50 text-xs font-semibold tracking-wide uppercase">
                Persisted Selector Batch Size
              </div>
              <div className="text-base-content mt-1 text-xl font-semibold">
                {initialSnapshot.config.values.selectorReferenceBatchSize}
              </div>
            </div>
            <div className="border-base-300 rounded-lg border px-4 py-3">
              <div className="text-base-content/50 text-xs font-semibold tracking-wide uppercase">
                Current Fixture
              </div>
              <div className="text-base-content mt-1 text-sm font-medium">
                {activeRuntimePreview
                  ? `${activeRuntimePreview.kind} runtime snapshot`
                  : fixture.label}
              </div>
            </div>
            <div className="border-base-300 rounded-lg border px-4 py-3">
              <div className="text-base-content/50 text-xs font-semibold tracking-wide uppercase">
                Checkpoints Loaded
              </div>
              <div className="text-base-content mt-1 text-xl font-semibold">
                {initialSnapshot.checkpoints.length}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn btn-neutral btn-sm"
              onClick={generateSelectorInput}
            >
              Generate test input
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={generateSelectorOutput}
            >
              Preview selector output
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={generateResolvedPersonas}
            >
              Preview resolved personas
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={generateTaskCandidates}
            >
              Preview task candidates
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={generateExecutionPreview}
            >
              Preview execution artifacts
            </button>
            <p className="text-base-content/65 text-sm">
              This is dev-only. It does not mutate `ai_agent_config`.
            </p>
          </div>
        </SectionCard>

        <JsonPreviewCard
          title="Fixture Opportunity Preview"
          data={activeRuntimePreview?.items ?? fixture.items}
          emptyLabel="Fixture items will appear here."
        />
      </div>

      <JsonPreviewCard
        title="Selector Input"
        data={selectorInput}
        emptyLabel="Generate test input to preview the next shared intake contract."
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <JsonPreviewCard
          title="Selector Output"
          data={selectorOutput}
          emptyLabel="Preview selector output to inspect selected references and prompt preview."
        />
        <JsonPreviewCard
          title="Resolved Personas"
          data={resolvedPersonas}
          emptyLabel="Preview resolved personas to inspect active/inactive filtering."
        />
        <JsonPreviewCard
          title="Task Candidate Preview"
          data={taskCandidates}
          emptyLabel="Preview task candidates to inspect dispatch_kind, dedupe_key, and payload."
        />
      </div>

      <JsonPreviewCard
        title="Task Write Preview"
        data={taskWritePreview}
        emptyLabel="Preview task candidates to inspect dedupe/cooldown write expectations."
      />

      <JsonPreviewCard
        title="Task Injection Preview"
        data={taskInjectionPreview}
        emptyLabel="Preview task candidates to inspect RPC-style injection result shaping."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <JsonPreviewCard
          title="Selector Prompt Preview"
          data={
            selectorOutput
              ? {
                  assembledPrompt: selectorOutput.promptPreview,
                }
              : null
          }
          emptyLabel="Preview selector output to inspect the assembled selector prompt."
        />
        <JsonPreviewCard
          title="Selector Model Payload"
          data={selectorOutput?.actualModelPayload ?? null}
          emptyLabel="Preview selector output to inspect the compact model payload."
        />
      </div>

      {resolvedPersonas && resolvedPersonas.length > 0 ? (
        <SectionCard title="Resolved Persona Cards">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {resolvedPersonas.map((persona) => (
              <ResolvedPersonaPreviewCard key={persona.personaId} persona={persona} />
            ))}
          </div>
        </SectionCard>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <JsonPreviewCard
          title="Execution Persona Context"
          data={executionPreview?.personaContext ?? null}
          emptyLabel="Preview execution artifacts to inspect persona and memory context."
        />
        <JsonPreviewCard
          title="Execution Source Context"
          data={executionPreview?.sourceContext ?? null}
          emptyLabel="Preview execution artifacts to inspect source post/comment linkage."
        />
        <JsonPreviewCard
          title="Execution Prompt Input"
          data={executionPreview?.promptInput ?? null}
          emptyLabel="Preview execution artifacts to inspect canonical prompt input."
        />
        <JsonPreviewCard
          title="Execution Model Payload"
          data={executionPreview?.actualModelPayload ?? null}
          emptyLabel="Preview execution artifacts to inspect the actual model payload."
        />
        <JsonPreviewCard
          title="Execution Parsed Output"
          data={executionPreview?.parsedOutput ?? null}
          emptyLabel="Preview execution artifacts to inspect parsed canonical output."
        />
        <JsonPreviewCard
          title="Execution Audit Output"
          data={executionPreview?.auditedOutput ?? null}
          emptyLabel="Preview execution artifacts to inspect audit JSON."
        />
        <JsonPreviewCard
          title="Execution Deterministic Checks"
          data={executionPreview?.deterministicChecks ?? null}
          emptyLabel="Preview execution artifacts to inspect schema and deterministic checks."
        />
        <JsonPreviewCard
          title="Execution Write Plan"
          data={executionPreview?.writePlan ?? null}
          emptyLabel="Preview execution artifacts to inspect write plan parity."
        />
      </div>

      <SectionCard title="Execution Preview">
        <PreviewPanel
          preview={executionPreview?.previewSurface ?? null}
          emptyLabel="Preview execution artifacts to inspect rendered output, prompt, raw response, and audit."
        />
      </SectionCard>

      <AiAgentPanel initialSnapshot={initialSnapshot} runtimePreviews={runtimePreviews} />
    </div>
  );
}
