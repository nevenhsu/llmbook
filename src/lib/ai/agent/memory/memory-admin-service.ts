import { AiAgentMemoryPreviewStore } from "@/lib/ai/agent/memory/memory-read-model";
import type {
  AiAgentCompressionPreview,
  AiAgentMemoryEntryPreview,
  AiAgentMemoryPersonaOption,
  AiAgentMemoryPersonaPreview,
} from "@/lib/ai/agent/memory/memory-preview";
import { createAdminClient } from "@/lib/supabase/admin";

export type AiAgentMemoryGuardedCompressResponse = {
  mode: "guarded_persist";
  personaId: string;
  summary: string;
  blocker: string;
  compressionPreview: AiAgentCompressionPreview;
};

export type AiAgentMemoryPersistedCompressResponse = {
  mode: "persisted";
  personaId: string;
  summary: string;
  compressionPreview: AiAgentCompressionPreview;
  persistedLongMemoryId: string;
  deletedShortMemoryIds: string[];
  protectedShortMemoryIds: string[];
  verificationTrace: {
    persistedLongMemoryId: string;
    persistedLongMemory: AiAgentMemoryEntryPreview | null;
    cleanup: {
      deletedShortMemoryIds: string[];
      protectedShortMemoryIds: string[];
    };
  };
  preview: AiAgentMemoryPersonaPreview;
};

export type AiAgentMemoryCompressResponse =
  | AiAgentMemoryGuardedCompressResponse
  | AiAgentMemoryPersistedCompressResponse;

export type AiAgentMemoryGuardedWriteResponse = {
  mode: "guarded_persist";
  personaId: string;
  summary: string;
  blocker: string;
  latestWritePreview: AiAgentMemoryPersonaPreview["latestWritePreview"];
};

export type AiAgentMemoryPersistedWriteResponse = {
  mode: "persisted";
  personaId: string;
  summary: string;
  latestWritePreview: AiAgentMemoryPersonaPreview["latestWritePreview"];
  persistedMemoryId: string;
  verificationTrace: {
    persistedMemoryId: string;
    selectedTaskId: string | null;
    persistedMemory: AiAgentMemoryEntryPreview | null;
  };
  preview: AiAgentMemoryPersonaPreview;
};

export type AiAgentMemoryWriteResponse =
  | AiAgentMemoryGuardedWriteResponse
  | AiAgentMemoryPersistedWriteResponse;

type PersistedMemoryInsertRow = {
  id: string;
  updated_at: string;
};

type MemoryAdminServiceDeps = {
  deleteCanonicalLongMemories: (personaId: string) => Promise<void>;
  insertCanonicalLongMemory: (input: {
    personaId: string;
    content: string;
    metadata: Record<string, unknown>;
  }) => Promise<PersistedMemoryInsertRow>;
  insertShortMemory: (input: {
    personaId: string;
    scope: "thread" | "board";
    content: string;
    metadata: Record<string, unknown>;
    importance: number;
  }) => Promise<PersistedMemoryInsertRow>;
  deleteShortMemories: (ids: string[]) => Promise<void>;
};

export class AiAgentMemoryAdminService {
  private readonly store: AiAgentMemoryPreviewStore;
  private readonly deps: MemoryAdminServiceDeps;

  public constructor(store?: AiAgentMemoryPreviewStore, deps?: Partial<MemoryAdminServiceDeps>) {
    this.store = store ?? new AiAgentMemoryPreviewStore();
    this.deps = {
      deleteCanonicalLongMemories:
        deps?.deleteCanonicalLongMemories ??
        (async (personaId) => {
          const supabase = createAdminClient();
          const { error } = await supabase
            .from("persona_memories")
            .delete()
            .eq("persona_id", personaId)
            .eq("memory_type", "long_memory")
            .eq("scope", "persona");

          if (error) {
            throw new Error(`delete canonical long memories failed: ${error.message}`);
          }
        }),
      insertCanonicalLongMemory:
        deps?.insertCanonicalLongMemory ??
        (async (input) => {
          const supabase = createAdminClient();
          const { data, error } = await supabase
            .from("persona_memories")
            .insert({
              persona_id: input.personaId,
              memory_type: "long_memory",
              scope: "persona",
              content: input.content,
              metadata: input.metadata,
            })
            .select("id, updated_at")
            .single<PersistedMemoryInsertRow>();

          if (error) {
            throw new Error(`insert canonical long memory failed: ${error.message}`);
          }

          return data;
        }),
      insertShortMemory:
        deps?.insertShortMemory ??
        (async (input) => {
          const supabase = createAdminClient();
          const { data, error } = await supabase
            .from("persona_memories")
            .insert({
              persona_id: input.personaId,
              memory_type: "memory",
              scope: input.scope,
              content: input.content,
              metadata: input.metadata,
              importance: input.importance,
            })
            .select("id, updated_at")
            .single<PersistedMemoryInsertRow>();

          if (error) {
            throw new Error(`insert short memory failed: ${error.message}`);
          }

          return data;
        }),
      deleteShortMemories:
        deps?.deleteShortMemories ??
        (async (ids) => {
          if (ids.length === 0) {
            return;
          }

          const supabase = createAdminClient();
          const { error } = await supabase.from("persona_memories").delete().in("id", ids);
          if (error) {
            throw new Error(`delete short memories failed: ${error.message}`);
          }
        }),
    };
  }

  public async getRuntimePreviewSet(): Promise<{
    personas: AiAgentMemoryPersonaOption[];
    previews: AiAgentMemoryPersonaPreview[];
  }> {
    return this.store.getRuntimePreviewSet();
  }

  public async getPersonaPreview(personaId: string): Promise<AiAgentMemoryPersonaPreview> {
    const previewSet = await this.store.getRuntimePreviewSet();
    const preview =
      previewSet.previews.find((item) => item.persona.personaId === personaId) ?? null;
    if (!preview) {
      throw new Error("persona preview not found");
    }
    return preview;
  }

  public async getLatestWritePreview(personaId: string) {
    const preview = await this.getPersonaPreview(personaId);
    return preview.latestWritePreview;
  }

  public async getCompressionBatchPreview(personaId: string) {
    const preview = await this.getPersonaPreview(personaId);
    return preview.compressionBatchPreview;
  }

  public async getCompressionPreview(personaId: string) {
    const preview = await this.getPersonaPreview(personaId);
    return preview.compressionPreview;
  }

  public async getPersistedLongMemory(
    personaId: string,
  ): Promise<AiAgentMemoryEntryPreview | null> {
    const preview = await this.getPersonaPreview(personaId);
    return preview.canonicalLongMemory;
  }

  public async persistLatestWrite(personaId: string): Promise<AiAgentMemoryWriteResponse> {
    const preview = await this.getPersonaPreview(personaId);
    const latestWritePreview = preview.latestWritePreview;

    if (latestWritePreview.path === "skipped" || !latestWritePreview.rowPreview) {
      return {
        mode: "guarded_persist",
        personaId,
        summary:
          "Latest write cannot be persisted because no runnable memory-write candidate is available.",
        blocker: "latest_write_unavailable",
        latestWritePreview,
      };
    }

    const persistedMemory = await this.deps.insertShortMemory({
      personaId,
      scope: latestWritePreview.rowPreview.scope,
      content: latestWritePreview.rowPreview.content,
      metadata: latestWritePreview.rowPreview.metadata,
      importance: latestWritePreview.rowPreview.importance,
    });

    return {
      mode: "persisted",
      personaId,
      summary: `Persisted latest memory write for ${personaId}.`,
      latestWritePreview,
      persistedMemoryId: persistedMemory.id,
      verificationTrace: {
        persistedMemoryId: persistedMemory.id,
        selectedTaskId: latestWritePreview.selectedTask?.taskId ?? null,
        persistedMemory: {
          id: persistedMemory.id,
          personaId,
          username: preview.persona.username,
          displayName: preview.persona.displayName,
          memoryType: "memory",
          scope: latestWritePreview.rowPreview.scope,
          threadId:
            latestWritePreview.rowPreview.scope === "thread"
              ? (latestWritePreview.selectedTask?.sourceId ?? null)
              : null,
          boardId:
            latestWritePreview.rowPreview.scope === "board"
              ? (latestWritePreview.selectedTask?.sourceId ?? null)
              : null,
          content: latestWritePreview.rowPreview.content,
          metadata: latestWritePreview.rowPreview.metadata,
          expiresAt: null,
          importance: latestWritePreview.rowPreview.importance,
          createdAt: persistedMemory.updated_at,
          updatedAt: persistedMemory.updated_at,
          sourceKind:
            typeof latestWritePreview.rowPreview.metadata.source_kind === "string"
              ? latestWritePreview.rowPreview.metadata.source_kind
              : null,
          continuityKind:
            typeof latestWritePreview.rowPreview.metadata.continuity_kind === "string"
              ? latestWritePreview.rowPreview.metadata.continuity_kind
              : null,
          hasOpenLoop: latestWritePreview.rowPreview.metadata.has_open_loop === true,
          promotionCandidate: latestWritePreview.rowPreview.metadata.promotion_candidate === true,
        },
      },
      preview: await this.getPersonaPreview(personaId),
    };
  }

  public async compressPersona(personaId: string): Promise<AiAgentMemoryCompressResponse> {
    const preview = await this.getPersonaPreview(personaId);
    const compressionPreview = preview.compressionPreview;
    const deletedShortMemoryIds = preview.compressionBatchPreview.deletableRows;
    const protectedShortMemoryIds = preview.compressionBatchPreview.protectedRows.map(
      (row) => row.id,
    );

    await this.deps.deleteCanonicalLongMemories(personaId);
    const persistedLongMemory = await this.deps.insertCanonicalLongMemory({
      personaId,
      content: compressionPreview.renderedLongMemory,
      metadata: {
        compression_result: compressionPreview.compressionResult,
        compression_audit_result: compressionPreview.compressionAuditResult,
        source_short_memory_ids: deletedShortMemoryIds,
        protected_short_memory_ids: protectedShortMemoryIds,
        persisted_by: "admin_agent_panel",
        generated_at: new Date().toISOString(),
      },
    });
    await this.deps.deleteShortMemories(deletedShortMemoryIds);

    return {
      mode: "persisted",
      personaId,
      summary: `Persisted canonical long memory and removed ${deletedShortMemoryIds.length} compressible short-memory rows.`,
      compressionPreview,
      persistedLongMemoryId: persistedLongMemory.id,
      deletedShortMemoryIds,
      protectedShortMemoryIds,
      verificationTrace: {
        persistedLongMemoryId: persistedLongMemory.id,
        persistedLongMemory: {
          id: persistedLongMemory.id,
          personaId,
          username: preview.persona.username,
          displayName: preview.persona.displayName,
          memoryType: "long_memory",
          scope: "persona",
          threadId: null,
          boardId: null,
          content: compressionPreview.renderedLongMemory,
          metadata: {
            compression_result: compressionPreview.compressionResult,
            compression_audit_result: compressionPreview.compressionAuditResult,
            source_short_memory_ids: deletedShortMemoryIds,
            protected_short_memory_ids: protectedShortMemoryIds,
            persisted_by: "admin_agent_panel",
          },
          expiresAt: null,
          importance: null,
          createdAt: persistedLongMemory.updated_at,
          updatedAt: persistedLongMemory.updated_at,
          sourceKind: "compression",
          continuityKind: "stable_persona",
          hasOpenLoop: false,
          promotionCandidate: false,
        },
        cleanup: {
          deletedShortMemoryIds,
          protectedShortMemoryIds,
        },
      },
      preview: await this.getPersonaPreview(personaId),
    };
  }

  public async compressNextPersona(): Promise<AiAgentMemoryPersistedCompressResponse | null> {
    const previewSet = await this.getRuntimePreviewSet();
    const nextPersona =
      previewSet.personas.find((persona) => persona.compressibleCount > 0) ??
      previewSet.personas[0] ??
      null;

    if (!nextPersona) {
      return null;
    }

    const result = await this.compressPersona(nextPersona.personaId);
    return result.mode === "persisted" ? result : null;
  }
}
