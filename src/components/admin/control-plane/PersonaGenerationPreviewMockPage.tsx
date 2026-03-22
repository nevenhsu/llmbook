"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import { ArrowLeft, FlaskConical } from "lucide-react";
import type {
  AiModelConfig,
  AiProviderConfig,
  PersonaProfile,
  PreviewResult,
  PersonaGenerationStructured,
} from "@/lib/ai/admin/control-plane-store";
import type { PersonaItem } from "@/lib/ai/admin/control-plane-types";
import type { PersonaGenerationModalPhase } from "./persona-generation-modal-utils";
import { buildPersonaUpdateExtraPrompt, derivePersonaUsername } from "./control-plane-utils";
import { PersonaGenerationSection } from "./sections/PersonaGenerationSection";
import {
  mockPersonaGenerationAdminExtraPrompt,
  mockPersonaGenerationGlobalPolicyContent,
  mockPersonaGenerationModelDisplayName,
  mockPersonaGenerationPreview,
  mockPersonaGenerationSeedPrompt,
} from "@/lib/ai/admin/persona-generation-preview-mock";
import { PERSONA_GENERATION_PREVIEW_MAX_OUTPUT_TOKENS } from "@/lib/ai/admin/persona-generation-token-budgets";

const mockProvider: AiProviderConfig = {
  id: "preview-provider-xai",
  providerKey: "xai",
  displayName: "xAI",
  sdkPackage: "@ai-sdk/xai",
  status: "active",
  testStatus: "success",
  keyLast4: "mock",
  hasKey: true,
  lastApiErrorCode: null,
  lastApiErrorMessage: null,
  lastApiErrorAt: null,
  createdAt: "2026-03-13T00:00:00.000Z",
  updatedAt: "2026-03-13T00:00:00.000Z",
};

const mockModel: AiModelConfig = {
  id: "preview-model-grok-fast-reasoning",
  providerId: mockProvider.id,
  modelKey: "grok-4.1-fast-reasoning",
  displayName: mockPersonaGenerationModelDisplayName,
  capability: "text_generation",
  status: "active",
  testStatus: "success",
  lifecycleStatus: "active",
  displayOrder: 1,
  lastErrorKind: null,
  lastErrorCode: null,
  lastErrorMessage: null,
  lastErrorAt: null,
  supportsInput: true,
  supportsImageInputPrompt: false,
  supportsOutput: true,
  contextWindow: 14000,
  maxOutputTokens: PERSONA_GENERATION_PREVIEW_MAX_OUTPUT_TOKENS,
  metadata: {
    previewOnly: true,
  },
  updatedAt: "2026-03-13T00:00:00.000Z",
};

const PREVIEW_GENERATE_DELAY_MS = 1000;
const PREVIEW_SAVE_DELAY_MS = 1000;
const mockPersona: PersonaItem = {
  id: "persona-jax-harlan",
  username: "ai_jax_harlan",
  display_name: "Jax Harlan",
  bio: mockPersonaGenerationPreview.structured.persona.bio,
  status: mockPersonaGenerationPreview.structured.persona.status,
};

const mockPersonaProfile: PersonaProfile = {
  persona: {
    id: mockPersona.id,
    username: mockPersona.username,
    display_name: mockPersona.display_name,
    bio: mockPersona.bio,
    status: mockPersona.status,
  },
  personaCore: {
    ...mockPersonaGenerationPreview.structured.persona_core,
    reference_sources: mockPersonaGenerationPreview.structured.reference_sources,
    reference_derivation: mockPersonaGenerationPreview.structured.reference_derivation,
    originalization_note: mockPersonaGenerationPreview.structured.originalization_note,
  },
  personaMemories: [],
};

export function PersonaGenerationPreviewMockPage() {
  const [personaGeneration, setPersonaGeneration] = useState({
    modelId: mockModel.id,
    extraPrompt: mockPersonaGenerationSeedPrompt,
  });
  const [personaUpdate, setPersonaUpdate] = useState({
    personaId: mockPersona.id,
    modelId: mockModel.id,
    extraPrompt: buildPersonaUpdateExtraPrompt(mockPersonaProfile),
  });
  const [personaGenerationLoading, setPersonaGenerationLoading] = useState(false);
  const [personaUpdateLoading, setPersonaUpdateLoading] = useState(false);
  const [personaPromptAssistLoading, setPersonaPromptAssistLoading] = useState(false);
  const [personaPromptAssistError, setPersonaPromptAssistError] = useState<string | null>(null);
  const [personaPromptAssistCompleted, setPersonaPromptAssistCompleted] = useState(false);
  const [personaPromptAssistElapsedSeconds, setPersonaPromptAssistElapsedSeconds] = useState(0);
  const [personaUpdatePromptAssistLoading, setPersonaUpdatePromptAssistLoading] = useState(false);
  const [personaUpdatePromptAssistError, setPersonaUpdatePromptAssistError] = useState<
    string | null
  >(null);
  const [personaUpdatePromptAssistCompleted, setPersonaUpdatePromptAssistCompleted] =
    useState(false);
  const [personaUpdatePromptAssistElapsedSeconds, setPersonaUpdatePromptAssistElapsedSeconds] =
    useState(0);
  const [personaPreviewRunCount, setPersonaPreviewRunCount] = useState(0);
  const [personaLastSavedAt, setPersonaLastSavedAt] = useState<string | null>(null);
  const [personaSaveLoading, setPersonaSaveLoading] = useState(false);
  const [personaGenerationMode, setPersonaGenerationMode] = useState<"create" | "update">("create");
  const [personaSaveForm, setPersonaSaveForm] = useState({
    displayName: mockPersonaGenerationPreview.structured.persona.display_name,
    username: derivePersonaUsername(mockPersonaGenerationPreview.structured.persona.display_name),
  });
  const [personaGenerationPreview, setPersonaGenerationPreview] = useState<
    (PreviewResult & { structured: PersonaGenerationStructured }) | null
  >(null);
  const [personaGenerationModalOpen, setPersonaGenerationModalOpen] = useState(false);
  const [personaGenerationModalPhase, setPersonaGenerationModalPhase] =
    useState<PersonaGenerationModalPhase>("idle");
  const [personaGenerationModalError, setPersonaGenerationModalError] = useState<string | null>(
    null,
  );
  const [personaGenerationModalRawOutput] = useState<string | null>(null);
  const [personaGenerationElapsedSeconds, setPersonaGenerationElapsedSeconds] = useState(0);
  const personaGenerationStartedAtRef = useRef<number | null>(null);
  useEffect(() => {
    if (!personaGenerationLoading || personaGenerationStartedAtRef.current === null) {
      return;
    }

    const updateElapsed = () => {
      setPersonaGenerationElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - personaGenerationStartedAtRef.current!) / 1000)),
      );
    };

    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [personaGenerationLoading]);

  const assistPersonaPromptByMode = async (mode: "create" | "update") => {
    const isUpdate = mode === "update";
    const setLoading = isUpdate
      ? setPersonaUpdatePromptAssistLoading
      : setPersonaPromptAssistLoading;
    const setError = isUpdate ? setPersonaUpdatePromptAssistError : setPersonaPromptAssistError;
    const setElapsed = isUpdate
      ? setPersonaUpdatePromptAssistElapsedSeconds
      : setPersonaPromptAssistElapsedSeconds;
    const setCompleted = isUpdate
      ? setPersonaUpdatePromptAssistCompleted
      : setPersonaPromptAssistCompleted;

    setError(null);
    setCompleted(false);
    setElapsed(0);
    setLoading(true);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, PREVIEW_GENERATE_DELAY_MS));
      if (isUpdate) {
        setPersonaUpdate((prev) => ({
          ...prev,
          extraPrompt: mockPersonaGenerationAdminExtraPrompt,
        }));
      } else {
        setPersonaGeneration((prev) => ({
          ...prev,
          extraPrompt: mockPersonaGenerationAdminExtraPrompt,
        }));
      }
      setElapsed(PREVIEW_GENERATE_DELAY_MS / 1000);
      setCompleted(true);
    } finally {
      setLoading(false);
    }
  };

  const assistPersonaPrompt = async () => assistPersonaPromptByMode("create");

  const assistPersonaUpdatePrompt = async () => assistPersonaPromptByMode("update");

  const runPersonaGenerationPreview = async () => {
    personaGenerationStartedAtRef.current = Date.now();
    setPersonaGenerationElapsedSeconds(0);
    setPersonaGenerationLoading(true);
    setPersonaGenerationMode("create");
    setPersonaGenerationModalOpen(true);
    setPersonaGenerationModalPhase("loading");
    setPersonaGenerationModalError(null);
    setPersonaGenerationPreview(null);
    setPersonaLastSavedAt(null);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, PREVIEW_GENERATE_DELAY_MS));
      setPersonaGenerationPreview(mockPersonaGenerationPreview);
      const displayName = mockPersonaGenerationPreview.structured.persona.display_name;
      setPersonaSaveForm({
        displayName,
        username: derivePersonaUsername(displayName),
      });
      setPersonaPreviewRunCount((prev) => prev + 1);
      setPersonaGenerationElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - personaGenerationStartedAtRef.current!) / 1000)),
      );
      setPersonaGenerationModalPhase("success");
    } finally {
      setPersonaGenerationLoading(false);
    }
  };

  const runPersonaUpdatePreview = async () => {
    setPersonaSaveForm((prev) =>
      personaGenerationMode === "update" && personaGenerationModalOpen
        ? prev
        : {
            displayName: mockPersona.display_name,
            username: mockPersona.username,
          },
    );
    personaGenerationStartedAtRef.current = Date.now();
    setPersonaGenerationElapsedSeconds(0);
    setPersonaUpdateLoading(true);
    setPersonaGenerationMode("update");
    setPersonaGenerationModalOpen(true);
    setPersonaGenerationModalPhase("loading");
    setPersonaGenerationModalError(null);
    setPersonaGenerationPreview(null);
    setPersonaLastSavedAt(null);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, PREVIEW_GENERATE_DELAY_MS));
      setPersonaGenerationPreview(mockPersonaGenerationPreview);
      setPersonaGenerationElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - personaGenerationStartedAtRef.current!) / 1000)),
      );
      setPersonaGenerationModalPhase("success");
    } finally {
      setPersonaUpdateLoading(false);
    }
  };

  const closePersonaGenerationModal = () => {
    setPersonaGenerationModalOpen(false);
    if (personaGenerationLoading) {
      setPersonaGenerationLoading(false);
      setPersonaUpdateLoading(false);
      personaGenerationStartedAtRef.current = null;
      setPersonaGenerationModalPhase("idle");
      setPersonaGenerationModalError(null);
      setPersonaGenerationElapsedSeconds(0);
    }
  };

  const savePersonaFromGeneration = async () => {
    if (!personaGenerationPreview) {
      return;
    }
    if (personaLastSavedAt) {
      return;
    }

    setPersonaSaveLoading(true);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, PREVIEW_SAVE_DELAY_MS));
      setPersonaLastSavedAt(new Date().toISOString());
      toast.success(personaGenerationMode === "update" ? "Persona updated" : "Persona saved");
    } finally {
      setPersonaSaveLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Generate Persona Flow Preview</h1>
          <p className="mt-1 text-sm opacity-65">
            Reuses the real admin Generate Persona section and modal. API calls are replaced with a
            local staged mock fixture.
          </p>
        </div>
        <Link href="/preview" className="btn btn-outline btn-sm gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Preview Index
        </Link>
      </div>

      <div className="alert alert-info text-sm">
        <FlaskConical className="h-4 w-4" />
        <span>
          This sandbox uses{" "}
          <span className="font-mono">src/mock-data/persona-generation-preview.json</span> for
          Prompt AI, Generate Persona, and modal review. No network request or database write
          happens here.
        </span>
      </div>

      <PersonaGenerationSection
        personaGeneration={personaGeneration}
        setPersonaGeneration={setPersonaGeneration}
        personaUpdate={personaUpdate}
        setPersonaUpdate={setPersonaUpdate}
        personas={[mockPersona]}
        selectedUpdatePersona={mockPersona}
        selectedUpdatePersonaProfile={mockPersonaProfile}
        selectedUpdatePersonaProfileLoading={false}
        personaGenerationModels={[mockModel]}
        providers={[mockProvider]}
        personaGenerationLoading={personaGenerationLoading}
        personaUpdateLoading={personaUpdateLoading}
        personaPromptAssistLoading={personaPromptAssistLoading}
        personaPromptAssistError={personaPromptAssistError}
        personaPromptAssistCompleted={personaPromptAssistCompleted}
        personaPromptAssistElapsedSeconds={personaPromptAssistElapsedSeconds}
        personaUpdatePromptAssistLoading={personaUpdatePromptAssistLoading}
        personaUpdatePromptAssistError={personaUpdatePromptAssistError}
        personaUpdatePromptAssistCompleted={personaUpdatePromptAssistCompleted}
        personaUpdatePromptAssistElapsedSeconds={personaUpdatePromptAssistElapsedSeconds}
        personaPreviewRunCount={personaPreviewRunCount}
        personaLastSavedAt={personaLastSavedAt}
        personaSaveForm={personaSaveForm}
        setPersonaSaveForm={setPersonaSaveForm}
        personaSaveLoading={personaSaveLoading}
        personaGenerationPreview={personaGenerationPreview}
        promptAssemblyGlobalPolicyContent={mockPersonaGenerationGlobalPolicyContent}
        personaGenerationMode={personaGenerationMode}
        personaGenerationModalOpen={personaGenerationModalOpen}
        personaGenerationModalPhase={personaGenerationModalPhase}
        personaGenerationModalError={personaGenerationModalError}
        personaGenerationModalRawOutput={personaGenerationModalRawOutput}
        personaGenerationElapsedSeconds={personaGenerationElapsedSeconds}
        personaStepStatus={{
          generated: personaPreviewRunCount > 0,
          saved: Boolean(personaLastSavedAt),
        }}
        assistPersonaPrompt={assistPersonaPrompt}
        assistPersonaUpdatePrompt={assistPersonaUpdatePrompt}
        runPersonaGenerationPreview={runPersonaGenerationPreview}
        runPersonaUpdatePreview={runPersonaUpdatePreview}
        closePersonaGenerationModal={closePersonaGenerationModal}
        savePersonaFromGeneration={savePersonaFromGeneration}
      />
    </div>
  );
}
