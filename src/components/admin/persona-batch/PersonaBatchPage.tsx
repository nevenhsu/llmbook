"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { AiModelConfig, AiProviderConfig } from "@/lib/ai/admin/control-plane-contract";
import type { PersonaBatchGenerationController } from "@/hooks/admin/usePersonaBatchGeneration";
import { usePersonaBatchGeneration } from "@/hooks/admin/usePersonaBatchGeneration";
import { ApiErrorDetailModal } from "@/components/shared/ApiErrorDetailModal";
import { PersonaDataModal } from "@/components/shared/PersonaDataModal";
import { ChunkSizeModal } from "./ChunkSizeModal";
import { EditContextPromptModal } from "./EditContextPromptModal";
import { EditPersonaIdentityModal } from "./EditPersonaIdentityModal";
import { PersonaBatchTable } from "./PersonaBatchTable";
import { PersonaBatchToolbar } from "./PersonaBatchToolbar";

type Props = {
  initialModels?: AiModelConfig[];
  initialProviders?: AiProviderConfig[];
  controller?: PersonaBatchGenerationController;
  title?: string;
  description?: string;
  topNotice?: ReactNode;
  headerActions?: ReactNode;
};

export function PersonaBatchPage({
  initialModels = [],
  initialProviders = [],
  controller,
  title = "Persona Batch Generation",
  description = "Generate and save multiple persona candidates in one batch-oriented workflow.",
  topNotice = null,
  headerActions = null,
}: Props) {
  const internalController = usePersonaBatchGeneration({
    initialModels,
    initialProviders,
  });
  const resolved = controller ?? internalController;
  const [chunkModalOpen, setChunkModalOpen] = useState(false);
  const [editingContextRowId, setEditingContextRowId] = useState<string | null>(null);
  const [editingIdentityRowId, setEditingIdentityRowId] = useState<string | null>(null);
  const [viewingPersonaRowId, setViewingPersonaRowId] = useState<string | null>(null);
  const [viewingErrorRowId, setViewingErrorRowId] = useState<string | null>(null);

  const editingContextRow = useMemo(
    () => resolved.rows.find((row) => row.rowId === editingContextRowId) ?? null,
    [editingContextRowId, resolved.rows],
  );
  const editingIdentityRow = useMemo(
    () => resolved.rows.find((row) => row.rowId === editingIdentityRowId) ?? null,
    [editingIdentityRowId, resolved.rows],
  );
  const viewingPersonaRow = useMemo(
    () => resolved.rows.find((row) => row.rowId === viewingPersonaRowId) ?? null,
    [resolved.rows, viewingPersonaRowId],
  );
  const viewingErrorRow = useMemo(
    () => resolved.rows.find((row) => row.rowId === viewingErrorRowId) ?? null,
    [resolved.rows, viewingErrorRowId],
  );

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">{title}</h1>
            <p className="text-sm opacity-65">{description}</p>
          </div>
          {headerActions ? <div className="shrink-0">{headerActions}</div> : null}
        </div>
        {topNotice}
      </section>

      <PersonaBatchToolbar
        modelId={resolved.modelId}
        models={resolved.personaGenerationModels}
        referenceInput={resolved.referenceInput}
        disableInputs={resolved.anyApiActive}
        addLoading={resolved.addLoading}
        addElapsedSeconds={resolved.addElapsedSeconds}
        addLastCompletedElapsedSeconds={resolved.addLastCompletedElapsedSeconds}
        onModelChange={resolved.setModelId}
        onReferenceInputChange={resolved.setReferenceInput}
        onAdd={() => void resolved.addReferenceRowsFromInput()}
      />

      <PersonaBatchTable
        rows={resolved.rows}
        chunkSize={resolved.chunkSize}
        bulkTask={resolved.bulkTask}
        bulkElapsedSeconds={resolved.bulkElapsedSeconds}
        bulkPausedTask={resolved.bulkPausedTask}
        bulkPausedElapsedSeconds={resolved.bulkPausedElapsedSeconds}
        bulkPauseRequested={resolved.bulkPauseRequested}
        bulkLastCompletedTask={resolved.bulkLastCompletedTask}
        bulkLastElapsedSeconds={resolved.bulkLastElapsedSeconds}
        anyApiActive={resolved.anyApiActive}
        bulkActionsDisabled={resolved.bulkActionsDisabled}
        canReset={resolved.canReset}
        canRemoveDuplicates={resolved.canRemoveDuplicates}
        onOpenChunkSize={() => setChunkModalOpen(true)}
        onBulkPrompt={() => void resolved.runBulkPromptAssist()}
        onBulkGenerate={() => void resolved.runBulkGenerate()}
        onBulkSave={() => void resolved.runBulkSave()}
        onRequestBulkPause={resolved.requestBulkPause}
        onResumeBulkTask={() => void resolved.resumeBulkTask()}
        onRemoveDuplicates={() => void resolved.removeDuplicateRows()}
        onReset={resolved.reset}
        onEditContextPrompt={setEditingContextRowId}
        onEditIdentity={setEditingIdentityRowId}
        onViewPersona={setViewingPersonaRowId}
        onViewError={setViewingErrorRowId}
        onRunPromptAssist={resolved.runRowPromptAssist}
        onRunGenerate={resolved.runRowGenerate}
        onRunSave={resolved.runRowSave}
        onClear={resolved.clearRow}
      />

      <ChunkSizeModal
        isOpen={chunkModalOpen}
        value={resolved.chunkSize}
        onClose={() => setChunkModalOpen(false)}
        onSave={(value) => {
          resolved.setChunkSize(value);
          setChunkModalOpen(false);
        }}
      />

      <EditContextPromptModal
        isOpen={editingContextRow !== null}
        referenceName={editingContextRow?.referenceName ?? ""}
        value={editingContextRow?.contextPrompt ?? ""}
        disabled={resolved.anyApiActive}
        promptLoading={editingContextRow?.activeTask === "prompt"}
        promptElapsedSeconds={
          editingContextRow?.activeTask === "prompt" ? editingContextRow.activeElapsedSeconds : 0
        }
        promptLastCompletedElapsedSeconds={
          editingContextRow?.lastCompletedTask === "prompt"
            ? editingContextRow.lastCompletedElapsedSeconds
            : null
        }
        onClose={() => setEditingContextRowId(null)}
        onPromptAssist={() => {
          if (editingContextRow) {
            void resolved.runRowPromptAssist(editingContextRow.rowId);
          }
        }}
        onSave={(value) => {
          if (editingContextRow) {
            resolved.updateContextPrompt(editingContextRow.rowId, value);
          }
          setEditingContextRowId(null);
        }}
      />

      <EditPersonaIdentityModal
        isOpen={editingIdentityRow !== null}
        displayName={editingIdentityRow?.displayName ?? ""}
        username={editingIdentityRow?.username ?? ""}
        disabled={resolved.anyApiActive}
        onClose={() => setEditingIdentityRowId(null)}
        onSave={(value) => {
          if (editingIdentityRow) {
            resolved.updatePersonaIdentity(editingIdentityRow.rowId, value);
          }
          setEditingIdentityRowId(null);
        }}
      />

      <PersonaDataModal
        isOpen={viewingPersonaRow !== null}
        title={viewingPersonaRow ? `${viewingPersonaRow.referenceName} Persona` : "Persona Data"}
        displayName={viewingPersonaRow?.displayName ?? undefined}
        username={viewingPersonaRow?.username ?? undefined}
        referenceLabels={
          viewingPersonaRow
            ? [
                viewingPersonaRow.referenceName,
                ...(viewingPersonaRow.personaData?.reference_sources.map((item) => item.name) ??
                  []),
              ]
            : []
        }
        structured={viewingPersonaRow?.personaData ?? null}
        onClose={() => setViewingPersonaRowId(null)}
        secondaryActionLabel="Regenerate"
        primaryActionLabel={viewingPersonaRow?.saved ? "Saved" : "Save"}
        secondaryDisabled={
          !viewingPersonaRow ||
          viewingPersonaRow.personaData === null ||
          resolved.anyApiActive ||
          viewingPersonaRow.referenceCheckStatus !== "new"
        }
        primaryDisabled={
          !viewingPersonaRow ||
          viewingPersonaRow.personaData === null ||
          viewingPersonaRow.saved ||
          resolved.anyApiActive ||
          viewingPersonaRow.referenceCheckStatus !== "new"
        }
        onSecondaryAction={() =>
          viewingPersonaRow ? resolved.runRowGenerate(viewingPersonaRow.rowId) : undefined
        }
        onPrimaryAction={() =>
          viewingPersonaRow ? resolved.runRowSave(viewingPersonaRow.rowId) : undefined
        }
      />

      <ApiErrorDetailModal
        isOpen={Boolean(viewingErrorRow?.latestError)}
        title={
          viewingErrorRow?.latestError
            ? `${viewingErrorRow.referenceName} ${viewingErrorRow.latestError.type} error`
            : "Row Error"
        }
        errorMessage={viewingErrorRow?.latestError?.message ?? ""}
        apiUrl={viewingErrorRow?.latestError?.apiUrl ?? ""}
        payload={viewingErrorRow?.latestError?.payload ?? null}
        rawResponse={viewingErrorRow?.latestError?.rawResponse ?? null}
        onClose={() => setViewingErrorRowId(null)}
      />
    </div>
  );
}
