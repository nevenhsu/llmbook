"use client";

import { CardCandidates } from "./CardCandidates";
import { CardLabConfig } from "./CardLabConfig";
import { CardOpportunities } from "./CardOpportunities";
import { CardTasks } from "./CardTasks";
import { DataModal } from "./DataModal";
import { PersonaGroupModal } from "./PersonaGroupModal";
import { PromptModal } from "./PromptModal";
import { useAgentLabRunner } from "./hooks/useAgentLabRunner";
import { buildTaskSavePayloadData } from "./lab-data";
import type { AgentLabPageProps } from "./types";

type Props = AgentLabPageProps & {
  tableLoading?: boolean;
  runPreview?: boolean;
};

export function AiAgentLabSurface(props: Props) {
  const runner = useAgentLabRunner(props);
  const opportunitiesRenderMode =
    props.tableLoading === true
      ? "loading"
      : props.runPreview === true || runner.selectorBusy
        ? "running"
        : "normal";
  const candidateRenderMode =
    props.tableLoading === true
      ? "loading"
      : props.runPreview === true
        ? "running-partial"
        : runner.candidateBusy
          ? "running-partial"
          : runner.sourceMode === "notification" && runner.selectorBusy
            ? "running-partial"
            : "normal";
  const tasksRenderMode =
    props.tableLoading === true
      ? "loading"
      : props.runPreview === true
        ? "running-partial"
        : runner.candidateBusy
          ? runner.sourceMode === "notification"
            ? "running-partial"
            : runner.modeState.taskStage.rows.length > 0
              ? "running-partial"
              : "running-full"
          : runner.sourceMode === "notification" && runner.selectorBusy
            ? "running-partial"
            : "normal";

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div className="space-y-2">
        <p className="text-base-content/50 text-sm font-semibold tracking-[0.24em] uppercase">
          {props.titleEyebrow ?? (props.dataSource === "mock" ? "Preview" : "Admin")}
        </p>
        <h1 className="text-base-content text-3xl font-semibold">
          {props.title ?? "AI Agent Lab"}
        </h1>
        <p className="text-base-content/70 max-w-3xl text-sm">
          {props.description ??
            (props.dataSource === "mock"
              ? "Mock-backed lab surface for previewing selector, candidate, and save UX."
              : "Runtime lab surface for inspecting live intake opportunities and manually saving tasks.")}
        </p>
      </div>

      <CardLabConfig
        sourceMode={runner.sourceMode}
        sourceModeOptions={props.sourceModeOptions}
        onSourceModeChange={runner.setSourceMode}
        models={props.models}
        providers={props.providers}
        modelId={runner.modelId}
        onModelChange={runner.setModelId}
        group={runner.modeState.personaGroup}
        onOpenGroup={() => runner.setGroupModalOpen(true)}
      />

      <CardOpportunities
        opportunities={runner.modeState.opportunities}
        selectorStage={runner.modeState.selectorStage}
        busy={runner.selectorBusy}
        renderMode={opportunitiesRenderMode}
        onRun={runner.runSelector}
        onShowPrompt={() =>
          runner.setPromptModal({
            title: "Opportunities Prompt",
            description:
              "Prompt for the opportunities stage, which must return canonical scores JSON for every opportunity.",
            prompt: runner.modeState.selectorStage.prompt,
            modelPayload: null,
            inputData: null,
          })
        }
        onShowData={() =>
          runner.setDataModal({
            title: "Opportunity Data",
            description: "Current source-mode opportunities and parsed opportunities output data.",
            data: {
              opportunitiesTableData: runner.modeState.opportunities,
              selectorOutputData: runner.modeState.selectorStage.outputData,
            },
            sections: [
              {
                title: "Opportunities Table Data",
                data: runner.modeState.opportunities,
              },
              {
                title: "Output Data",
                data: runner.modeState.selectorStage.outputData,
              },
            ],
          })
        }
      />

      <CardCandidates
        sourceMode={runner.sourceMode}
        candidateStage={runner.modeState.candidateStage}
        busy={runner.candidateBusy}
        canRun={runner.canRunCandidate}
        renderMode={candidateRenderMode}
        onRun={runner.runCandidate}
        onShowPrompt={() =>
          runner.setPromptModal({
            title: "Candidates Prompt",
            description:
              "Prompt for the candidates stage, which must return canonical speaker_candidates JSON.",
            prompt: runner.modeState.candidateStage.prompt,
            modelPayload: null,
            inputData: null,
          })
        }
        onShowData={() =>
          runner.setDataModal({
            title: "Candidate Data",
            description:
              "Current candidates input data for LLM run and parsed candidates output data.",
            data: {
              candidateInputData: runner.modeState.candidateStage.inputData,
              candidateOutputData: runner.modeState.candidateStage.outputData,
            },
            sections: [
              {
                title: "Input Data",
                data: runner.modeState.candidateStage.inputData,
              },
              {
                title: "Output Data",
                data: runner.modeState.candidateStage.outputData,
              },
            ],
          })
        }
      />

      <CardTasks
        taskStage={runner.modeState.taskStage}
        renderMode={tasksRenderMode}
        onSaveAll={runner.saveAllTasks}
        onSaveRow={runner.saveTaskRow}
        onShowData={() =>
          runner.setDataModal({
            title: "Task Data",
            description: "Rows prepared for insertion into the persona_tasks table.",
            data: buildTaskSavePayloadData(runner.modeState.taskStage.rows),
            sections: [
              {
                title: "persona_tasks Rows",
                data: buildTaskSavePayloadData(runner.modeState.taskStage.rows),
              },
            ],
          })
        }
      />

      <PromptModal
        open={Boolean(runner.promptModal?.prompt)}
        title={runner.promptModal?.title ?? ""}
        description={runner.promptModal?.description ?? ""}
        assembledPrompt={runner.promptModal?.prompt ?? null}
        modelPayload={runner.promptModal?.modelPayload ?? null}
        promptInput={runner.promptModal?.inputData ?? null}
        onClose={() => runner.setPromptModal(null)}
      />
      <DataModal
        open={Boolean(runner.dataModal)}
        title={runner.dataModal?.title ?? ""}
        description={runner.dataModal?.description ?? ""}
        data={runner.dataModal?.data ?? null}
        sections={runner.dataModal?.sections}
        onClose={() => runner.setDataModal(null)}
      />
      <PersonaGroupModal
        open={runner.groupModalOpen}
        sourceMode={runner.sourceMode}
        group={runner.modeState.personaGroup}
        onClose={() => runner.setGroupModalOpen(false)}
        onSave={runner.savePersonaGroup}
        busy={runner.groupSaveBusy}
      />
    </div>
  );
}
