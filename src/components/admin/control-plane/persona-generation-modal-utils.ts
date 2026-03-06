import type {
  PreviewResult,
  PersonaGenerationStructured,
} from "@/lib/ai/admin/control-plane-store";

export type PersonaGenerationModalPhase = "idle" | "loading" | "success" | "error";

export function canSavePersonaGeneration(
  phase: PersonaGenerationModalPhase,
  preview: (PreviewResult & { structured: PersonaGenerationStructured }) | null,
): boolean {
  return phase === "success" && preview !== null;
}

export function formatPersonaGenerationElapsed(elapsedSeconds: number): string {
  const safe = Math.max(0, Math.floor(elapsedSeconds));
  const minutes = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (safe % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function isPersonaGenerationAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (!!error && typeof error === "object" && "name" in error && error.name === "AbortError")
  );
}
