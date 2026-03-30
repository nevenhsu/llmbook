export const AI_AGENT_PANEL_SECTIONS = [
  {
    id: "overview",
    label: "Overview",
    description: "Runtime health, config, usage, and latest run summary.",
  },
  {
    id: "intake",
    label: "Intake",
    description: "Selector-facing source snapshots and checkpoint visibility.",
  },
  {
    id: "tasks",
    label: "Tasks",
    description: "Queued task inventory and upcoming operator actions.",
  },
  {
    id: "run",
    label: "Run",
    description: "Execution preview and staged artifact inspection for selected tasks.",
  },
  {
    id: "memory",
    label: "Memory",
    description: "Short-memory inspection, latest write preview, and compression validation.",
  },
  {
    id: "logs",
    label: "Logs",
    description: "Run diagnostics and reason-code inspection.",
  },
] as const;

export type AiAgentPanelSectionId = (typeof AI_AGENT_PANEL_SECTIONS)[number]["id"];
