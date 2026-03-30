import type { AiAgentMemoryPersonaPreview } from "@/lib/ai/agent/memory/memory-preview";

export type AiAgentMemoryArtifactDetailId =
  | "latest-write"
  | "compression-batch"
  | "compression-output"
  | "rendered-long-memory";

export type AiAgentMemoryArtifactDetailSection = {
  title: string;
  format: "json" | "text";
  content: unknown;
  description?: string;
};

export type AiAgentMemoryArtifactDetail = {
  title: string;
  description: string;
  sections: AiAgentMemoryArtifactDetailSection[];
};

export function buildMemoryArtifactDetail(
  preview: AiAgentMemoryPersonaPreview,
  artifactId: AiAgentMemoryArtifactDetailId,
): AiAgentMemoryArtifactDetail {
  switch (artifactId) {
    case "latest-write":
      return {
        title: "Latest Write Detail",
        description:
          "Inspect the selected task, row preview, and persisted row that shape the next memory-write path.",
        sections: [
          {
            title: "Summary",
            format: "text",
            content: preview.latestWritePreview.summary,
          },
          {
            title: "Latest Write Preview",
            format: "json",
            content: preview.latestWritePreview,
          },
          {
            title: "Persisted Row",
            format: "json",
            content: preview.latestWritePreview.persistedRow,
            description: "Most recent short-memory row currently visible for this persona.",
          },
        ],
      };
    case "compression-batch":
      return {
        title: "Compression Batch Detail",
        description:
          "Inspect which short memories are selected, which rows stay protected, and what canonical long memory currently exists.",
        sections: [
          {
            title: "Compression Batch Preview",
            format: "json",
            content: preview.compressionBatchPreview,
          },
          {
            title: "Current Canonical Long Memory",
            format: "json",
            content: preview.canonicalLongMemory,
          },
        ],
      };
    case "compression-output":
      return {
        title: "Compression Output Detail",
        description:
          "Inspect the staged compression result, audit output, and cleanup planning before persistence.",
        sections: [
          {
            title: "Compression Result",
            format: "json",
            content: preview.compressionPreview.compressionResult,
          },
          {
            title: "Compression Audit Result",
            format: "json",
            content: preview.compressionPreview.compressionAuditResult,
          },
          {
            title: "Cleanup Consequences",
            format: "json",
            content: preview.compressionPreview.cleanupPreview,
          },
        ],
      };
    case "rendered-long-memory":
      return {
        title: "Rendered Long Memory",
        description:
          "Inspect the rendered canonical long memory alongside the cleanup consequences that would accompany persistence.",
        sections: [
          {
            title: "Rendered Long Memory",
            format: "text",
            content: preview.compressionPreview.renderedLongMemory,
          },
          {
            title: "Cleanup Consequences",
            format: "json",
            content: preview.compressionPreview.cleanupPreview,
          },
        ],
      };
  }
}
