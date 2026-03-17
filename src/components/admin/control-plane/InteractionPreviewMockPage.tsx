"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FlaskConical } from "lucide-react";
import type { PreviewResult } from "@/lib/ai/admin/control-plane-store";
import type { PersonaGenerationModalPhase } from "./persona-generation-modal-utils";
import { PersonaInteractionSection } from "./sections/PersonaInteractionSection";
import {
  mockInteractionPreview,
  mockInteractionPreviewComment,
  mockInteractionPreviewDefaultInput,
  mockInteractionPreviewModel,
  mockInteractionPreviewPersona,
  mockInteractionPreviewPersonaProfile,
  mockInteractionPreviewProvider,
  mockInteractionPreviewRandomPostTaskContext,
  mockInteractionPreviewRandomCommentTaskContext,
  mockInteractionPreviewRelatedCommentTaskContext,
  mockInteractionPreviewRelatedPostTaskContext,
} from "@/lib/ai/admin/interaction-preview-mock";

const PREVIEW_RUN_DELAY_MS = 1000;
const TASK_CONTEXT_ASSIST_DELAY_MS = 800;

export function InteractionPreviewMockPage() {
  const [interactionInput, setInteractionInput] = useState(mockInteractionPreviewDefaultInput);
  const [interactionPreview, setInteractionPreview] = useState<PreviewResult | null>(null);
  const [interactionPreviewModalOpen, setInteractionPreviewModalOpen] = useState(false);
  const [interactionPreviewModalPhase, setInteractionPreviewModalPhase] =
    useState<PersonaGenerationModalPhase>("idle");
  const [interactionPreviewModalError] = useState<string | null>(null);
  const [interactionPreviewElapsedSeconds, setInteractionPreviewElapsedSeconds] = useState(0);
  const [interactionTaskAssistLoading, setInteractionTaskAssistLoading] = useState(false);
  const [interactionTaskAssistError] = useState<string | null>(null);
  const [interactionTaskAssistElapsedSeconds, setInteractionTaskAssistElapsedSeconds] = useState(0);
  const interactionPreviewStartedAtRef = useRef<number | null>(null);
  const interactionTaskAssistStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (
      interactionPreviewModalPhase !== "loading" ||
      interactionPreviewStartedAtRef.current === null
    ) {
      return;
    }

    const updateElapsed = () => {
      setInteractionPreviewElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - interactionPreviewStartedAtRef.current!) / 1000)),
      );
    };

    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [interactionPreviewModalPhase]);

  useEffect(() => {
    if (!interactionTaskAssistLoading || interactionTaskAssistStartedAtRef.current === null) {
      return;
    }

    const updateElapsed = () => {
      setInteractionTaskAssistElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - interactionTaskAssistStartedAtRef.current!) / 1000)),
      );
    };

    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [interactionTaskAssistLoading]);

  const runInteractionPreview = async () => {
    interactionPreviewStartedAtRef.current = Date.now();
    setInteractionPreviewElapsedSeconds(0);
    setInteractionPreviewModalOpen(true);
    setInteractionPreviewModalPhase("loading");
    setInteractionPreview(null);

    try {
      await new Promise((resolve) => window.setTimeout(resolve, PREVIEW_RUN_DELAY_MS));
      const previewFixture =
        interactionInput.taskType === "post"
          ? mockInteractionPreview
          : mockInteractionPreviewComment;
      setInteractionPreview({
        ...previewFixture,
        assembledPrompt: previewFixture.assembledPrompt.replace(
          interactionInput.taskType === "post"
            ? "[task_context]\nWrite a post about Cthulhu-themed worldbuilding and creature design for the forum."
            : "[task_context]\nReply to a user's Cthulhu-themed concept art draft and point out which details make the creature feel cosmic rather than just monstrous.",
          `[task_context]\n${interactionInput.taskContext}`,
        ),
      });
      setInteractionPreviewElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - interactionPreviewStartedAtRef.current!) / 1000)),
      );
      setInteractionPreviewModalPhase("success");
    } finally {
      interactionPreviewStartedAtRef.current = null;
    }
  };

  const closeInteractionPreviewModal = () => {
    setInteractionPreviewModalOpen(false);
  };

  const assistInteractionTaskContext = async () => {
    interactionTaskAssistStartedAtRef.current = Date.now();
    setInteractionTaskAssistLoading(true);
    setInteractionTaskAssistElapsedSeconds(0);

    try {
      await new Promise((resolve) => window.setTimeout(resolve, TASK_CONTEXT_ASSIST_DELAY_MS));
      setInteractionInput((prev) => ({
        ...prev,
        taskContext: (() => {
          const hasExistingContext = prev.taskContext.trim().length > 0;
          if (prev.taskType === "post") {
            return hasExistingContext
              ? mockInteractionPreviewRelatedPostTaskContext
              : mockInteractionPreviewRandomPostTaskContext;
          }
          return hasExistingContext
            ? mockInteractionPreviewRelatedCommentTaskContext
            : mockInteractionPreviewRandomCommentTaskContext;
        })(),
      }));
      setInteractionTaskAssistElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - interactionTaskAssistStartedAtRef.current!) / 1000)),
      );
    } finally {
      interactionTaskAssistStartedAtRef.current = null;
      setInteractionTaskAssistLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Interaction Preview Flow Preview</h1>
          <p className="mt-1 text-sm opacity-65">
            Reuses the real admin Interaction Preview section and modal. API calls are replaced with
            a local mock fixture and local loading states.
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
          This sandbox uses <span className="font-mono">interaction-preview-mock.json</span> for
          modal review. No network request or database write happens here.
        </span>
      </div>

      <PersonaInteractionSection
        interactionInput={interactionInput}
        setInteractionInput={setInteractionInput}
        personas={[mockInteractionPreviewPersona]}
        textModels={[mockInteractionPreviewModel]}
        providers={[mockInteractionPreviewProvider]}
        interactionPreview={interactionPreview}
        interactionPreviewModalOpen={interactionPreviewModalOpen}
        interactionPreviewModalPhase={interactionPreviewModalPhase}
        interactionPreviewModalError={interactionPreviewModalError}
        interactionPreviewElapsedSeconds={interactionPreviewElapsedSeconds}
        selectedPersona={mockInteractionPreviewPersona}
        selectedPersonaProfile={mockInteractionPreviewPersonaProfile}
        interactionTaskAssistLoading={interactionTaskAssistLoading}
        interactionTaskAssistError={interactionTaskAssistError}
        interactionTaskAssistElapsedSeconds={interactionTaskAssistElapsedSeconds}
        runInteractionPreview={runInteractionPreview}
        closeInteractionPreviewModal={closeInteractionPreviewModal}
        assistInteractionTaskContext={assistInteractionTaskContext}
      />
    </div>
  );
}
