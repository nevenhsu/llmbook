"use client";

import { useMemo, useState } from "react";
import { SectionCard } from "@/components/admin/control-plane/SectionCard";
import { ArtifactDetailModal } from "@/components/ui/ArtifactDetailModal";
import { JsonPreviewCard } from "@/components/ui/JsonPreviewCard";
import { ApiError, apiFetchJson, apiPost } from "@/lib/api/fetch-json";
import { buildMemoryArtifactDetail } from "@/lib/ai/agent/memory";
import type {
  AiAgentMemoryCompressResponse,
  AiAgentMemoryArtifactDetailId,
  AiAgentMemoryPersonaOption,
  AiAgentMemoryPersonaPreview,
  AiAgentMemoryWriteResponse,
} from "@/lib/ai/agent/memory";

function formatDateTime(value: string | null): string {
  if (!value) {
    return "none";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Taipei",
  }).format(new Date(value));
}

export default function AiAgentMemoryPage({
  fixturePreviews,
  runtimePreviews,
}: {
  fixturePreviews: {
    personas: AiAgentMemoryPersonaOption[];
    previews: AiAgentMemoryPersonaPreview[];
  };
  runtimePreviews?: {
    personas: AiAgentMemoryPersonaOption[];
    previews: AiAgentMemoryPersonaPreview[];
  } | null;
}) {
  const [mode, setMode] = useState<"fixture" | "runtime">("fixture");
  const [runtimeSet, setRuntimeSet] = useState(runtimePreviews);
  const [memoryPending, setMemoryPending] = useState<string | null>(null);
  const [memoryApiResult, setMemoryApiResult] = useState<unknown>(null);
  const [memoryVerificationTrace, setMemoryVerificationTrace] = useState<unknown>(null);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [openArtifact, setOpenArtifact] = useState<AiAgentMemoryArtifactDetailId | null>(null);
  const activeSet =
    mode === "runtime" && runtimeSet?.previews.length ? runtimeSet : fixturePreviews;
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(
    activeSet.personas[0]?.personaId ?? fixturePreviews.personas[0]?.personaId ?? "",
  );

  function mergeRuntimePreview(personaId: string, patch: Partial<AiAgentMemoryPersonaPreview>) {
    setRuntimeSet((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        previews: current.previews.map((preview) =>
          preview.persona.personaId === personaId ? { ...preview, ...patch } : preview,
        ),
      };
    });
  }

  async function handleMemoryAction(
    action:
      | "refresh"
      | "latest-write"
      | "persist-latest-write"
      | "compression-batch"
      | "preview-compression"
      | "persist-compression",
  ) {
    if (mode !== "runtime" || !selectedPersonaId) {
      return;
    }

    setMemoryPending(action);
    setMemoryApiResult(null);
    setMemoryVerificationTrace(null);
    setMemoryError(null);

    try {
      if (action === "refresh") {
        const response = await apiFetchJson<{ preview: AiAgentMemoryPersonaPreview }>(
          `/api/admin/ai/agent/memory/personas/${selectedPersonaId}`,
        );
        mergeRuntimePreview(selectedPersonaId, response.preview);
        setMemoryApiResult(response);
        return;
      }

      if (action === "latest-write") {
        const response = await apiFetchJson<{
          latestWritePreview: AiAgentMemoryPersonaPreview["latestWritePreview"];
        }>(`/api/admin/ai/agent/memory/personas/${selectedPersonaId}/latest-write-preview`);
        mergeRuntimePreview(selectedPersonaId, {
          latestWritePreview: response.latestWritePreview,
        });
        setMemoryApiResult(response);
        return;
      }

      if (action === "persist-latest-write") {
        const response = await apiPost<{ result: AiAgentMemoryWriteResponse }>(
          `/api/admin/ai/agent/memory/personas/${selectedPersonaId}/persist-latest-write`,
          {},
        );
        if (response.result.mode === "persisted") {
          mergeRuntimePreview(selectedPersonaId, response.result.preview);
          setMemoryVerificationTrace(response.result.verificationTrace);
        }
        setMemoryApiResult(response);
        return;
      }

      if (action === "compression-batch") {
        const response = await apiPost<{
          compressionBatchPreview: AiAgentMemoryPersonaPreview["compressionBatchPreview"];
        }>(
          `/api/admin/ai/agent/memory/personas/${selectedPersonaId}/compression-batch-preview`,
          {},
        );
        mergeRuntimePreview(selectedPersonaId, {
          compressionBatchPreview: response.compressionBatchPreview,
        });
        setMemoryApiResult(response);
        return;
      }

      if (action === "persist-compression") {
        const response = await apiPost<{ result: AiAgentMemoryCompressResponse }>(
          `/api/admin/ai/agent/memory/personas/${selectedPersonaId}/compress`,
          {},
        );
        if (response.result.mode === "persisted") {
          mergeRuntimePreview(selectedPersonaId, response.result.preview);
          setMemoryVerificationTrace(response.result.verificationTrace);
        }
        setMemoryApiResult(response);
        return;
      }

      const response = await apiPost<{
        compressionPreview: AiAgentMemoryPersonaPreview["compressionPreview"];
      }>(`/api/admin/ai/agent/memory/personas/${selectedPersonaId}/preview-compression`, {});
      mergeRuntimePreview(selectedPersonaId, {
        compressionPreview: response.compressionPreview,
      });
      setMemoryApiResult(response);
    } catch (error) {
      if (error instanceof ApiError) {
        setMemoryError(error.message);
      } else {
        setMemoryError("Memory API request failed.");
      }
    } finally {
      setMemoryPending(null);
    }
  }

  const activePreview = useMemo(
    () =>
      activeSet.previews.find((preview) => preview.persona.personaId === selectedPersonaId) ??
      activeSet.previews[0] ??
      null,
    [activeSet, selectedPersonaId],
  );
  const activeArtifactDetail =
    activePreview && openArtifact ? buildMemoryArtifactDetail(activePreview, openArtifact) : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div className="space-y-2">
        <p className="text-base-content/50 text-sm font-semibold tracking-[0.24em] uppercase">
          Preview
        </p>
        <h1 className="text-base-content text-3xl font-semibold">AI Agent Memory Lab</h1>
        <p className="text-base-content/70 max-w-3xl text-sm">
          Dedicated memory validation surface for short-memory writes, compression-batch selection,
          rendered long memory, and cleanup preview.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="Persona Picker">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`btn btn-sm ${mode === "fixture" ? "btn-neutral" : "btn-ghost border-base-300 border"}`}
                onClick={() => setMode("fixture")}
              >
                Fixture
              </button>
              <button
                type="button"
                className={`btn btn-sm ${mode === "runtime" ? "btn-neutral" : "btn-ghost border-base-300 border"}`}
                onClick={() => setMode("runtime")}
                disabled={!runtimeSet?.previews.length}
              >
                Runtime
              </button>
            </div>

            <label className="form-control gap-2">
              <span className="text-base-content/60 text-xs font-semibold tracking-wide uppercase">
                Persona
              </span>
              <select
                className="select select-bordered"
                value={activePreview?.persona.personaId ?? ""}
                onChange={(event) => setSelectedPersonaId(event.target.value)}
              >
                {activeSet.personas.map((persona) => (
                  <option key={persona.personaId} value={persona.personaId}>
                    {persona.displayName} (@{persona.username})
                  </option>
                ))}
              </select>
            </label>

            {activePreview ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={mode !== "runtime" || memoryPending !== null}
                    onClick={() => {
                      void handleMemoryAction("refresh");
                    }}
                  >
                    {memoryPending === "refresh" ? "Refreshing..." : "Refresh persona memory"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={mode !== "runtime" || memoryPending !== null}
                    onClick={() => {
                      void handleMemoryAction("latest-write");
                    }}
                  >
                    {memoryPending === "latest-write" ? "Loading..." : "Preview latest write"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    disabled={mode !== "runtime" || memoryPending !== null}
                    onClick={() => {
                      void handleMemoryAction("persist-latest-write");
                    }}
                  >
                    {memoryPending === "persist-latest-write"
                      ? "Persisting..."
                      : "Persist latest write"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={mode !== "runtime" || memoryPending !== null}
                    onClick={() => {
                      void handleMemoryAction("compression-batch");
                    }}
                  >
                    {memoryPending === "compression-batch"
                      ? "Loading..."
                      : "Preview compression batch"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-neutral"
                    disabled={mode !== "runtime" || memoryPending !== null}
                    onClick={() => {
                      void handleMemoryAction("preview-compression");
                    }}
                  >
                    {memoryPending === "preview-compression"
                      ? "Running..."
                      : "Run compression preview"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    disabled={mode !== "runtime" || memoryPending !== null}
                    onClick={() => {
                      void handleMemoryAction("persist-compression");
                    }}
                  >
                    {memoryPending === "persist-compression"
                      ? "Persisting..."
                      : "Persist compression"}
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="border-base-300 rounded-lg border p-3 text-sm">
                    <div className="text-base-content/50 text-xs tracking-wide uppercase">
                      Short Memory
                    </div>
                    <div className="text-base-content mt-1 text-xl font-semibold">
                      {activePreview.persona.shortMemoryCount}
                    </div>
                  </div>
                  <div className="border-base-300 rounded-lg border p-3 text-sm">
                    <div className="text-base-content/50 text-xs tracking-wide uppercase">
                      Compressible
                    </div>
                    <div className="text-base-content mt-1 text-xl font-semibold">
                      {activePreview.persona.compressibleCount}
                    </div>
                  </div>
                  <div className="border-base-300 rounded-lg border p-3 text-sm">
                    <div className="text-base-content/50 text-xs tracking-wide uppercase">
                      Open Loops
                    </div>
                    <div className="text-base-content mt-1 text-xl font-semibold">
                      {activePreview.persona.openLoopCount}
                    </div>
                  </div>
                  <div className="border-base-300 rounded-lg border p-3 text-sm">
                    <div className="text-base-content/50 text-xs tracking-wide uppercase">
                      Long Memory
                    </div>
                    <div className="text-base-content mt-1 text-xl font-semibold">
                      {activePreview.persona.longMemoryPresent ? "Present" : "Missing"}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-base-content/70 text-sm">
                No persona memory previews are available.
              </p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Canonical Long Memory">
          {activePreview?.canonicalLongMemory ? (
            <div className="text-base-content/80 space-y-3 text-sm">
              <div className="text-base-content/50 text-xs tracking-wide uppercase">Content</div>
              <p className="whitespace-pre-wrap">{activePreview.canonicalLongMemory.content}</p>
              <div className="text-base-content/60 text-xs">
                Updated {formatDateTime(activePreview.canonicalLongMemory.updatedAt)}
              </div>
            </div>
          ) : (
            <p className="text-base-content/70 text-sm">
              No canonical long-memory row is available for the selected persona.
            </p>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard title="Recent Short Memories">
          {activePreview?.recentShortMemories.length ? (
            <div className="overflow-x-auto">
              <table className="table-sm table">
                <thead>
                  <tr>
                    <th>Scope</th>
                    <th>Importance</th>
                    <th>Source</th>
                    <th>Continuity</th>
                    <th>Open Loop</th>
                    <th>Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {activePreview.recentShortMemories.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <div className="font-medium">{entry.scope}</div>
                        <div className="text-base-content/60 text-xs">{entry.content}</div>
                      </td>
                      <td>{entry.importance ?? "n/a"}</td>
                      <td>{entry.sourceKind ?? "n/a"}</td>
                      <td>{entry.continuityKind ?? "n/a"}</td>
                      <td>{entry.hasOpenLoop ? "yes" : "no"}</td>
                      <td>{formatDateTime(entry.expiresAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-base-content/70 text-sm">No short-memory rows are available yet.</p>
          )}
        </SectionCard>
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!activePreview}
              onClick={() => setOpenArtifact("latest-write")}
            >
              View latest write detail
            </button>
          </div>
          <JsonPreviewCard
            title="Latest Write Preview"
            data={activePreview?.latestWritePreview ?? null}
            emptyLabel="Select a persona to inspect latest memory-write preview."
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!activePreview}
              onClick={() => setOpenArtifact("compression-batch")}
            >
              View compression batch detail
            </button>
          </div>
          <JsonPreviewCard
            title="Compression Batch Preview"
            data={activePreview?.compressionBatchPreview ?? null}
            emptyLabel="Select a persona to inspect compression-batch selection."
          />
        </div>
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!activePreview}
              onClick={() => setOpenArtifact("compression-output")}
            >
              View compression output detail
            </button>
          </div>
          <JsonPreviewCard
            title="Compression Output Preview"
            data={activePreview?.compressionPreview ?? null}
            emptyLabel="Select a persona to inspect compression output and cleanup preview."
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        {memoryError ? (
          <SectionCard title="Memory API Result">
            <p className="text-error text-sm">{memoryError}</p>
          </SectionCard>
        ) : (
          <SectionCard title="Memory API Result">
            {memoryVerificationTrace ? (
              <div className="text-base-content/80 space-y-3 text-sm">
                <div className="text-base-content/50 text-xs tracking-wide uppercase">
                  Memory Verification Trace
                </div>
                <pre className="bg-base-200 max-h-56 overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap">
                  {JSON.stringify(memoryVerificationTrace, null, 2)}
                </pre>
              </div>
            ) : (
              <p className="text-base-content/70 text-sm">
                Trigger runtime memory actions to inspect the admin API response payload.
              </p>
            )}
          </SectionCard>
        )}
        <JsonPreviewCard
          title="Memory API Payload"
          data={memoryApiResult}
          emptyLabel="Trigger a runtime memory action to inspect the admin API response."
        />
      </div>

      <SectionCard title="Rendered Long-Memory Preview">
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!activePreview}
              onClick={() => setOpenArtifact("rendered-long-memory")}
            >
              View rendered long memory
            </button>
          </div>
          {activePreview ? (
            <pre className="bg-base-200 max-h-[420px] overflow-auto rounded-lg p-4 text-sm whitespace-pre-wrap">
              {activePreview.compressionPreview.renderedLongMemory}
            </pre>
          ) : (
            <p className="text-base-content/70 text-sm">
              Select a persona to inspect rendered long memory.
            </p>
          )}
        </div>
      </SectionCard>

      <ArtifactDetailModal detail={activeArtifactDetail} onClose={() => setOpenArtifact(null)} />
    </div>
  );
}
