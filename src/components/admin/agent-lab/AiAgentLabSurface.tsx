"use client";

import { CardCandidates } from "./CardCandidates";
import { CardLabConfig } from "./CardLabConfig";
import { CardOpportunities } from "./CardOpportunities";
import { CardTasks } from "./CardTasks";
import { DataModal } from "./DataModal";
import { PersonaGroupModal } from "./PersonaGroupModal";
import { PromptModal } from "./PromptModal";
import { useAgentLabRunner } from "./hooks/useAgentLabRunner";
import type { AgentLabPageProps } from "./types";

export function AiAgentLabSurface(props: AgentLabPageProps) {
  const runner = useAgentLabRunner(props);

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
        onRun={runner.runSelector}
        onShowPrompt={() =>
          runner.setPromptModal({
            title: "Selector Prompt",
            description: "Prompt and payload for the opportunity selection stage.",
            prompt: runner.modeState.selectorStage.prompt,
            modelPayload: runner.modeState.selectorStage.outputData,
            inputData: runner.modeState.selectorStage.inputData,
          })
        }
        onShowData={() =>
          runner.setDataModal({
            title: "Opportunity Data",
            description: "Current source-mode opportunities and selector result payload.",
            data: {
              opportunities: runner.modeState.opportunities,
              selectorStage: runner.modeState.selectorStage,
            },
          })
        }
      />

      <CardCandidates
        sourceMode={runner.sourceMode}
        candidateStage={runner.modeState.candidateStage}
        busy={runner.candidateBusy}
        canRun={runner.canRunCandidate}
        onRun={runner.runCandidate}
        onShowPrompt={() =>
          runner.setPromptModal({
            title: "Candidate Prompt",
            description: "Prompt and payload for the candidate generation stage.",
            prompt: runner.modeState.candidateStage.prompt,
            modelPayload: runner.modeState.candidateStage.outputData,
            inputData: runner.modeState.candidateStage.inputData,
          })
        }
        onShowData={() =>
          runner.setDataModal({
            title: "Candidate Data",
            description: "Selected references, candidate rows, and raw candidate payload.",
            data: {
              candidateStage: runner.modeState.candidateStage,
            },
          })
        }
      />

      <CardTasks
        taskStage={runner.modeState.taskStage}
        onSaveAll={runner.saveAllTasks}
        onSaveRow={runner.saveTaskRow}
        onShowData={() =>
          runner.setDataModal({
            title: "Task Data",
            description:
              "Current task rows including save state, candidate payload, and save results.",
            data: {
              taskStage: runner.modeState.taskStage,
            },
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
        onClose={() => runner.setDataModal(null)}
      />
      <PersonaGroupModal
        open={runner.groupModalOpen}
        group={runner.modeState.personaGroup}
        onClose={() => runner.setGroupModalOpen(false)}
      />
    </div>
  );
}
