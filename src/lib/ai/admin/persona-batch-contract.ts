import type { PersonaGenerationStructured } from "@/lib/ai/admin/control-plane-contract";

export type PersonaBatchActionType = "check" | "prompt" | "generate" | "save";

export type PersonaBatchReferenceCheckStatus =
  | "unchecked"
  | "checking"
  | "new"
  | "duplicate"
  | "check_error";

export type PersonaBatchRowTask = "prompt" | "generate" | "save" | null;

export type PersonaBatchPersonaData = PersonaGenerationStructured;

export type PersonaBatchErrorRecord = {
  type: PersonaBatchActionType;
  message: string;
  apiUrl: string;
  payload: unknown;
  rawResponse: unknown;
  createdAt: string;
};

export type PersonaBatchRow = {
  rowId: string;
  referenceName: string;
  dbReferenceExists: boolean;
  contextPrompt: string;
  contextPromptReferenceNames: string[];
  displayName: string;
  username: string;
  personaData: PersonaBatchPersonaData | null;
  saved: boolean;
  savedPersonaId: string | null;
  promptChangedSinceGenerate: boolean;
  referenceCheckStatus: PersonaBatchReferenceCheckStatus;
  activeTask: PersonaBatchRowTask;
  activeElapsedSeconds: number;
  lastCompletedTask: PersonaBatchRowTask;
  lastCompletedElapsedSeconds: number;
  latestError: PersonaBatchErrorRecord | null;
};

export type PersonaReferenceCheckResult = {
  input: string;
  matchKey: string;
  romanizedName: string;
  exists: boolean;
};
