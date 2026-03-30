import { generateImage } from "ai";
import { createXai } from "@ai-sdk/xai";
import sharp from "sharp";
import { buildExecutionPreviewFromTask } from "@/lib/ai/agent/execution/execution-preview";
import type { AiAgentRecentTaskSnapshot } from "@/lib/ai/agent/read-models/overview-read-model";
import { loadDecryptedProviderSecrets } from "@/lib/ai/llm/provider-secrets";
import { resolveLlmInvocationConfig } from "@/lib/ai/llm/runtime-config-provider";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_BUCKET = "media";

type MediaOwnerTable = "comments" | "posts";
type MediaJobStatus = "PENDING_GENERATION" | "RUNNING" | "DONE" | "FAILED";

type MediaJobRow = {
  id: string;
  persona_id: string | null;
  post_id: string | null;
  comment_id: string | null;
  status: "PENDING_GENERATION" | "RUNNING" | "DONE" | "FAILED";
  image_prompt: string | null;
  url: string | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
};

export type AiAgentMediaExecutionPersistedResult = {
  taskId: string;
  mediaId: string;
  ownerTable: MediaOwnerTable;
  ownerId: string;
  status: MediaJobStatus;
  imagePrompt: string;
  imageAlt: string | null;
  url: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
};

type GeneratedImageArtifact = {
  buffer: Buffer;
  mimeType: string;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  extension: string;
};

type MediaJobServiceDeps = {
  loadJobById: (mediaId: string) => Promise<MediaJobRow | null>;
  findExistingJob: (input: {
    ownerTable: MediaOwnerTable;
    ownerId: string;
    personaId: string;
    imagePrompt: string;
  }) => Promise<MediaJobRow | null>;
  markJobRunning: (mediaId: string) => Promise<MediaJobRow>;
  createPendingJob: (input: {
    ownerTable: MediaOwnerTable;
    ownerId: string;
    personaId: string;
    imagePrompt: string;
  }) => Promise<MediaJobRow>;
  markJobDone: (input: {
    mediaId: string;
    url: string;
    mimeType: string;
    width: number | null;
    height: number | null;
    sizeBytes: number;
  }) => Promise<MediaJobRow>;
  markJobFailed: (mediaId: string) => Promise<void>;
  generateArtifact: (input: { prompt: string }) => Promise<GeneratedImageArtifact>;
  uploadArtifact: (input: {
    mediaId: string;
    personaId: string;
    buffer: Buffer;
    mimeType: string;
    extension: string;
  }) => Promise<{ url: string }>;
};

function readExtensionFromMimeType(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "png";
  }
}

function mapRowToResult(input: {
  task: AiAgentRecentTaskSnapshot;
  ownerTable: MediaOwnerTable;
  ownerId: string;
  imagePrompt: string;
  imageAlt: string | null;
  row: MediaJobRow;
}): AiAgentMediaExecutionPersistedResult {
  return {
    taskId: input.task.id,
    mediaId: input.row.id,
    ownerTable: input.ownerTable,
    ownerId: input.ownerId,
    status: input.row.status,
    imagePrompt: input.row.image_prompt ?? input.imagePrompt,
    imageAlt: input.imageAlt,
    url: input.row.url,
    mimeType: input.row.mime_type,
    width: input.row.width,
    height: input.row.height,
    sizeBytes: input.row.size_bytes,
  };
}

export class AiAgentMediaJobService {
  private readonly deps: MediaJobServiceDeps;

  public constructor(options?: { deps?: Partial<MediaJobServiceDeps> }) {
    this.deps = {
      loadJobById: options?.deps?.loadJobById ?? ((mediaId) => this.loadJobById(mediaId)),
      findExistingJob: options?.deps?.findExistingJob ?? ((input) => this.findExistingJob(input)),
      markJobRunning: options?.deps?.markJobRunning ?? ((mediaId) => this.markJobRunning(mediaId)),
      createPendingJob:
        options?.deps?.createPendingJob ?? ((input) => this.createPendingJob(input)),
      markJobDone: options?.deps?.markJobDone ?? ((input) => this.markJobDone(input)),
      markJobFailed: options?.deps?.markJobFailed ?? ((mediaId) => this.markJobFailed(mediaId)),
      generateArtifact:
        options?.deps?.generateArtifact ?? ((input) => this.generateArtifact(input)),
      uploadArtifact: options?.deps?.uploadArtifact ?? ((input) => this.uploadArtifact(input)),
    };
  }

  public async executeForTask(
    task: AiAgentRecentTaskSnapshot,
  ): Promise<AiAgentMediaExecutionPersistedResult> {
    const executionPreview = buildExecutionPreviewFromTask(task);
    const mediaWritePayload = executionPreview.writePlan.mediaWrite?.payload as
      | {
          image_prompt?: string | null;
          image_alt?: string | null;
        }
      | undefined;
    const imagePrompt = mediaWritePayload?.image_prompt?.trim() ?? "";
    if (!imagePrompt) {
      throw new Error("media execution blocked by missing image prompt");
    }

    if (task.status !== "DONE" || !task.resultId || !task.resultType) {
      throw new Error("media execution requires a completed text task");
    }

    const ownerTable: MediaOwnerTable = task.resultType === "comment" ? "comments" : "posts";
    const ownerId = task.resultId;
    const imageAlt = mediaWritePayload?.image_alt ?? null;

    const existing = await this.deps.findExistingJob({
      ownerTable,
      ownerId,
      personaId: task.personaId,
      imagePrompt,
    });

    if (existing?.status === "DONE" && existing.url) {
      return mapRowToResult({
        task,
        ownerTable,
        ownerId,
        imagePrompt,
        imageAlt,
        row: existing,
      });
    }

    const pendingJob =
      existing ??
      (await this.deps.createPendingJob({
        ownerTable,
        ownerId,
        personaId: task.personaId,
        imagePrompt,
      }));

    try {
      const artifact = await this.deps.generateArtifact({ prompt: imagePrompt });
      const uploaded = await this.deps.uploadArtifact({
        mediaId: pendingJob.id,
        personaId: task.personaId,
        buffer: artifact.buffer,
        mimeType: artifact.mimeType,
        extension: artifact.extension,
      });

      const completed = await this.deps.markJobDone({
        mediaId: pendingJob.id,
        url: uploaded.url,
        mimeType: artifact.mimeType,
        width: artifact.width,
        height: artifact.height,
        sizeBytes: artifact.sizeBytes,
      });

      return mapRowToResult({
        task,
        ownerTable,
        ownerId,
        imagePrompt,
        imageAlt,
        row: completed,
      });
    } catch (error) {
      await this.deps.markJobFailed(pendingJob.id);
      throw error;
    }
  }

  public async rerunJobById(mediaId: string): Promise<MediaJobRow> {
    const existing = await this.deps.loadJobById(mediaId);
    if (!existing) {
      throw new Error("media job not found");
    }
    if (existing.status === "DONE") {
      throw new Error("media retry blocked by completed row");
    }
    if (existing.status === "RUNNING") {
      throw new Error("media retry blocked by active row");
    }
    if (!existing.persona_id) {
      throw new Error("media retry blocked by missing persona");
    }
    if (!existing.image_prompt?.trim()) {
      throw new Error("media retry blocked by missing image prompt");
    }

    const runningJob = await this.deps.markJobRunning(existing.id);

    try {
      const artifact = await this.deps.generateArtifact({ prompt: existing.image_prompt });
      const uploaded = await this.deps.uploadArtifact({
        mediaId: existing.id,
        personaId: existing.persona_id,
        buffer: artifact.buffer,
        mimeType: artifact.mimeType,
        extension: artifact.extension,
      });

      return await this.deps.markJobDone({
        mediaId: runningJob.id,
        url: uploaded.url,
        mimeType: artifact.mimeType,
        width: artifact.width,
        height: artifact.height,
        sizeBytes: artifact.sizeBytes,
      });
    } catch (error) {
      await this.deps.markJobFailed(existing.id);
      throw error;
    }
  }

  private async loadJobById(mediaId: string): Promise<MediaJobRow | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("media")
      .select(
        "id, persona_id, post_id, comment_id, status, image_prompt, url, mime_type, width, height, size_bytes",
      )
      .eq("id", mediaId)
      .maybeSingle<MediaJobRow>();

    if (error) {
      throw new Error(`load media job by id failed: ${error.message}`);
    }

    return data ?? null;
  }

  private async findExistingJob(input: {
    ownerTable: MediaOwnerTable;
    ownerId: string;
    personaId: string;
    imagePrompt: string;
  }): Promise<MediaJobRow | null> {
    const supabase = createAdminClient();
    const ownerColumn = input.ownerTable === "comments" ? "comment_id" : "post_id";
    const { data, error } = await supabase
      .from("media")
      .select(
        "id, persona_id, post_id, comment_id, status, image_prompt, url, mime_type, width, height, size_bytes",
      )
      .eq(ownerColumn, input.ownerId)
      .eq("persona_id", input.personaId)
      .eq("image_prompt", input.imagePrompt)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<MediaJobRow>();

    if (error) {
      throw new Error(`load media job failed: ${error.message}`);
    }

    return data ?? null;
  }

  private async createPendingJob(input: {
    ownerTable: MediaOwnerTable;
    ownerId: string;
    personaId: string;
    imagePrompt: string;
  }): Promise<MediaJobRow> {
    const supabase = createAdminClient();
    const payload =
      input.ownerTable === "comments"
        ? {
            comment_id: input.ownerId,
            persona_id: input.personaId,
            status: "PENDING_GENERATION" as const,
            image_prompt: input.imagePrompt,
          }
        : {
            post_id: input.ownerId,
            persona_id: input.personaId,
            status: "PENDING_GENERATION" as const,
            image_prompt: input.imagePrompt,
          };
    const { data, error } = await supabase
      .from("media")
      .insert(payload)
      .select(
        "id, persona_id, post_id, comment_id, status, image_prompt, url, mime_type, width, height, size_bytes",
      )
      .single<MediaJobRow>();

    if (error || !data) {
      throw new Error(`insert media failed: ${error?.message ?? "missing inserted row"}`);
    }

    return data;
  }

  private async markJobRunning(mediaId: string): Promise<MediaJobRow> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("media")
      .update({
        status: "RUNNING",
        url: null,
        mime_type: null,
        width: null,
        height: null,
        size_bytes: null,
      })
      .eq("id", mediaId)
      .select(
        "id, persona_id, post_id, comment_id, status, image_prompt, url, mime_type, width, height, size_bytes",
      )
      .single<MediaJobRow>();

    if (error || !data) {
      throw new Error(`mark media job running failed: ${error?.message ?? "missing updated row"}`);
    }

    return data;
  }

  private async markJobDone(input: {
    mediaId: string;
    url: string;
    mimeType: string;
    width: number | null;
    height: number | null;
    sizeBytes: number;
  }): Promise<MediaJobRow> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("media")
      .update({
        status: "DONE",
        url: input.url,
        mime_type: input.mimeType,
        width: input.width,
        height: input.height,
        size_bytes: input.sizeBytes,
      })
      .eq("id", input.mediaId)
      .select(
        "id, persona_id, post_id, comment_id, status, image_prompt, url, mime_type, width, height, size_bytes",
      )
      .single<MediaJobRow>();

    if (error || !data) {
      throw new Error(`complete media job failed: ${error?.message ?? "missing updated row"}`);
    }

    return data;
  }

  private async markJobFailed(mediaId: string): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase.from("media").update({ status: "FAILED" }).eq("id", mediaId);
    if (error) {
      throw new Error(`mark media job failed: ${error.message}`);
    }
  }

  private async generateArtifact(input: { prompt: string }): Promise<GeneratedImageArtifact> {
    const invocation = await resolveLlmInvocationConfig({
      taskType: "generic",
      capability: "image_generation",
    });
    const target = invocation.route?.targets?.[0] ?? null;
    if (!target) {
      throw new Error("image generation route is not configured");
    }

    if (target.providerId !== "xai") {
      throw new Error(`image generation provider is unsupported: ${target.providerId}`);
    }

    const secretMap = await loadDecryptedProviderSecrets([target.providerId]);
    const apiKey = secretMap.get(target.providerId)?.apiKey?.trim() ?? "";
    if (!apiKey) {
      throw new Error("missing image generation api key");
    }

    const client = createXai({ apiKey });
    const imageResult = await generateImage({
      model: client.image(target.modelId),
      prompt: input.prompt,
      aspectRatio: "1:1",
      n: 1,
      maxRetries: 0,
    });
    const first = imageResult.images[0];
    const base64 = first?.base64 ?? "";
    const mimeType = first?.mediaType ?? "image/png";
    if (!base64) {
      throw new Error("image generation returned empty output");
    }

    const buffer = Buffer.from(base64, "base64");
    const metadata = await sharp(buffer).metadata();
    return {
      buffer,
      mimeType,
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      sizeBytes: buffer.length,
      extension: readExtensionFromMimeType(mimeType),
    };
  }

  private async uploadArtifact(input: {
    mediaId: string;
    personaId: string;
    buffer: Buffer;
    mimeType: string;
    extension: string;
  }): Promise<{ url: string }> {
    const supabase = createAdminClient();
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET;
    const key = `ai-generated/${input.personaId}/${input.mediaId}.${input.extension}`;
    const { error } = await supabase.storage
      .from(bucket)
      .upload(key, input.buffer, { contentType: input.mimeType, upsert: true });

    if (error) {
      throw new Error(`upload generated media failed: ${error.message}`);
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(key);
    return { url: data.publicUrl };
  }
}
