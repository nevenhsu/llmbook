import "server-only";
import { generateImage } from "ai";
import { createXai } from "@ai-sdk/xai";
import sharp from "sharp";
import { buildExecutionPreviewFromTask } from "@/lib/ai/agent/execution/execution-preview";
import type { TaskSnapshot } from "@/lib/ai/agent/read-models/task-snapshot";
import { loadDecryptedProviderSecrets } from "@/lib/ai/llm/provider-secrets";
import { resolveLlmInvocationConfig } from "@/lib/ai/llm/runtime-config-provider";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_BUCKET = "media";
const MEDIA_RETRY_BACKOFF_MINUTES = [5, 15, 30] as const;

type MediaOwnerTable = "comments" | "posts";
type MediaJobStatus = "PENDING_GENERATION" | "RUNNING" | "DONE" | "FAILED";

type MediaJobRow = {
  id: string;
  persona_id: string | null;
  post_id: string | null;
  comment_id: string | null;
  status: MediaJobStatus;
  image_prompt: string | null;
  url: string | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
  last_error: string | null;
  created_at: string;
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
  retryCount: number;
  maxRetries: number;
  nextRetryAt: string | null;
  lastError: string | null;
};

type GeneratedImageArtifact = {
  buffer: Buffer;
  mimeType: string;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  extension: string;
};

type TaskMediaContext = {
  task: TaskSnapshot;
  ownerTable: MediaOwnerTable;
  ownerId: string;
  imagePrompt: string;
  imageAlt: string | null;
};

type MediaJobServiceDeps = {
  loadJobById: (mediaId: string) => Promise<MediaJobRow | null>;
  claimNextReadyJob: () => Promise<MediaJobRow | null>;
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
  updateFailureState: (input: { row: MediaJobRow; errorMessage: string }) => Promise<MediaJobRow>;
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

function readRetryBackoffMinutes(retryCount: number): number | null {
  return MEDIA_RETRY_BACKOFF_MINUTES[retryCount - 1] ?? null;
}

function readTaskMediaContext(task: TaskSnapshot): TaskMediaContext | null {
  const executionPreview = buildExecutionPreviewFromTask(task);
  const mediaWritePayload = executionPreview.writePlan.mediaWrite?.payload as
    | {
        image_prompt?: string | null;
        image_alt?: string | null;
      }
    | undefined;
  const imagePrompt = mediaWritePayload?.image_prompt?.trim() ?? "";
  if (!imagePrompt) {
    return null;
  }

  if (task.status !== "DONE" || !task.resultId || !task.resultType) {
    throw new Error("media execution requires a completed text task");
  }

  return {
    task,
    ownerTable: task.resultType === "comment" ? "comments" : "posts",
    ownerId: task.resultId,
    imagePrompt,
    imageAlt: mediaWritePayload?.image_alt ?? null,
  };
}

function mapRowToResult(input: {
  task: TaskSnapshot;
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
    retryCount: input.row.retry_count,
    maxRetries: input.row.max_retries,
    nextRetryAt: input.row.next_retry_at,
    lastError: input.row.last_error,
  };
}

export class AiAgentMediaJobService {
  private readonly deps: MediaJobServiceDeps;

  public constructor(options?: { deps?: Partial<MediaJobServiceDeps> }) {
    this.deps = {
      loadJobById: options?.deps?.loadJobById ?? ((mediaId) => this.loadJobById(mediaId)),
      claimNextReadyJob:
        options?.deps?.claimNextReadyJob ?? (() => this.readAndClaimNextReadyJob()),
      findExistingJob: options?.deps?.findExistingJob ?? ((input) => this.findExistingJob(input)),
      markJobRunning: options?.deps?.markJobRunning ?? ((mediaId) => this.markJobRunning(mediaId)),
      createPendingJob:
        options?.deps?.createPendingJob ?? ((input) => this.createPendingJob(input)),
      markJobDone: options?.deps?.markJobDone ?? ((input) => this.markJobDone(input)),
      updateFailureState:
        options?.deps?.updateFailureState ?? ((input) => this.updateFailureState(input)),
      generateArtifact:
        options?.deps?.generateArtifact ?? ((input) => this.generateArtifact(input)),
      uploadArtifact: options?.deps?.uploadArtifact ?? ((input) => this.uploadArtifact(input)),
    };
  }

  public async ensurePendingJobForTask(
    task: TaskSnapshot,
  ): Promise<AiAgentMediaExecutionPersistedResult | null> {
    const context = readTaskMediaContext(task);
    if (!context) {
      return null;
    }

    const existing = await this.deps.findExistingJob({
      ownerTable: context.ownerTable,
      ownerId: context.ownerId,
      personaId: task.personaId,
      imagePrompt: context.imagePrompt,
    });

    if (existing) {
      return mapRowToResult({
        task,
        ownerTable: context.ownerTable,
        ownerId: context.ownerId,
        imagePrompt: context.imagePrompt,
        imageAlt: context.imageAlt,
        row: existing,
      });
    }

    const pendingJob = await this.deps.createPendingJob({
      ownerTable: context.ownerTable,
      ownerId: context.ownerId,
      personaId: task.personaId,
      imagePrompt: context.imagePrompt,
    });

    return mapRowToResult({
      task,
      ownerTable: context.ownerTable,
      ownerId: context.ownerId,
      imagePrompt: context.imagePrompt,
      imageAlt: context.imageAlt,
      row: pendingJob,
    });
  }

  public async executeForTask(task: TaskSnapshot): Promise<AiAgentMediaExecutionPersistedResult> {
    const context = readTaskMediaContext(task);
    if (!context) {
      throw new Error("media execution blocked by missing image prompt");
    }

    const pendingJob = await this.ensurePendingJobForTask(task);
    if (!pendingJob) {
      throw new Error("media execution blocked by missing image prompt");
    }
    if (pendingJob.status === "DONE" && pendingJob.url) {
      return pendingJob;
    }
    if (pendingJob.status === "RUNNING") {
      return pendingJob;
    }

    const runningJob = await this.deps.markJobRunning(pendingJob.mediaId);
    const completed = await this.executeRunningJob(runningJob);
    return mapRowToResult({
      task,
      ownerTable: context.ownerTable,
      ownerId: context.ownerId,
      imagePrompt: context.imagePrompt,
      imageAlt: context.imageAlt,
      row: completed,
    });
  }

  public async claimNextReadyJob(): Promise<MediaJobRow | null> {
    return this.deps.claimNextReadyJob();
  }

  public async executeQueuedJobById(mediaId: string): Promise<MediaJobRow> {
    const existing = await this.deps.loadJobById(mediaId);
    if (!existing) {
      throw new Error("media job not found");
    }
    if (existing.status !== "RUNNING") {
      throw new Error("media queue execution requires a RUNNING row");
    }

    return this.executeRunningJob(existing);
  }

  public async rerunJobById(mediaId: string): Promise<MediaJobRow> {
    const existing = await this.deps.loadJobById(mediaId);
    if (!existing) {
      throw new Error("media job not found");
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
    return this.executeRunningJob(runningJob);
  }

  private async executeRunningJob(runningJob: MediaJobRow): Promise<MediaJobRow> {
    if (!runningJob.persona_id) {
      throw new Error("media execution blocked by missing persona");
    }
    if (!runningJob.image_prompt?.trim()) {
      throw new Error("media execution blocked by missing image prompt");
    }

    try {
      const artifact = await this.deps.generateArtifact({ prompt: runningJob.image_prompt });
      const uploaded = await this.deps.uploadArtifact({
        mediaId: runningJob.id,
        personaId: runningJob.persona_id,
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
      await this.deps.updateFailureState({
        row: runningJob,
        errorMessage: error instanceof Error ? error.message : "Unknown media generation error",
      });
      throw error;
    }
  }

  private async loadJobById(mediaId: string): Promise<MediaJobRow | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("media")
      .select(
        "id, persona_id, post_id, comment_id, status, image_prompt, url, mime_type, width, height, size_bytes, retry_count, max_retries, next_retry_at, last_error, created_at",
      )
      .eq("id", mediaId)
      .maybeSingle<MediaJobRow>();

    if (error) {
      throw new Error(`load media job by id failed: ${error.message}`);
    }

    return data ?? null;
  }

  private async readAndClaimNextReadyJob(): Promise<MediaJobRow | null> {
    const supabase = createAdminClient();
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("media")
      .select(
        "id, persona_id, post_id, comment_id, status, image_prompt, url, mime_type, width, height, size_bytes, retry_count, max_retries, next_retry_at, last_error, created_at",
      )
      .eq("status", "PENDING_GENERATION")
      .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
      .order("created_at", { ascending: true })
      .limit(25)
      .returns<MediaJobRow[]>();

    if (error) {
      throw new Error(`claim media job failed: ${error.message}`);
    }

    for (const candidate of data ?? []) {
      const { data: claimed, error: claimError } = await supabase
        .from("media")
        .update({
          status: "RUNNING",
          url: null,
          mime_type: null,
          width: null,
          height: null,
          size_bytes: null,
          next_retry_at: null,
          last_error: null,
        })
        .eq("id", candidate.id)
        .eq("status", "PENDING_GENERATION")
        .select(
          "id, persona_id, post_id, comment_id, status, image_prompt, url, mime_type, width, height, size_bytes, retry_count, max_retries, next_retry_at, last_error, created_at",
        )
        .maybeSingle<MediaJobRow>();

      if (claimError) {
        throw new Error(`claim media job failed: ${claimError.message}`);
      }
      if (claimed) {
        return claimed;
      }
    }

    return null;
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
        "id, persona_id, post_id, comment_id, status, image_prompt, url, mime_type, width, height, size_bytes, retry_count, max_retries, next_retry_at, last_error, created_at",
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
    const payload = {
      persona_id: input.personaId,
      status: "PENDING_GENERATION" as const,
      retry_count: 0,
      max_retries: 3,
      next_retry_at: null,
      last_error: null,
      image_prompt: input.imagePrompt,
      ...(input.ownerTable === "comments"
        ? { comment_id: input.ownerId, post_id: undefined as string | undefined }
        : { post_id: input.ownerId, comment_id: undefined as string | undefined }),
    };
    const { data, error } = await supabase
      .from("media")
      .insert(payload as any)
      .select(
        "id, persona_id, post_id, comment_id, status, image_prompt, url, mime_type, width, height, size_bytes, retry_count, max_retries, next_retry_at, last_error, created_at",
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
        next_retry_at: null,
        last_error: null,
      })
      .eq("id", mediaId)
      .select(
        "id, persona_id, post_id, comment_id, status, image_prompt, url, mime_type, width, height, size_bytes, retry_count, max_retries, next_retry_at, last_error, created_at",
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
        next_retry_at: null,
        last_error: null,
      })
      .eq("id", input.mediaId)
      .select(
        "id, persona_id, post_id, comment_id, status, image_prompt, url, mime_type, width, height, size_bytes, retry_count, max_retries, next_retry_at, last_error, created_at",
      )
      .single<MediaJobRow>();

    if (error || !data) {
      throw new Error(`complete media job failed: ${error?.message ?? "missing updated row"}`);
    }

    return data;
  }

  private async updateFailureState(input: {
    row: MediaJobRow;
    errorMessage: string;
  }): Promise<MediaJobRow> {
    const supabase = createAdminClient();
    const retryCount = input.row.retry_count + 1;
    const retryBackoffMinutes = readRetryBackoffMinutes(retryCount);
    const canRetry = retryCount < input.row.max_retries && retryBackoffMinutes !== null;
    const nextRetryAt = canRetry
      ? new Date(Date.now() + retryBackoffMinutes * 60_000).toISOString()
      : null;

    const { data, error } = await supabase
      .from("media")
      .update({
        status: canRetry ? "PENDING_GENERATION" : "FAILED",
        retry_count: retryCount,
        next_retry_at: nextRetryAt,
        last_error: input.errorMessage,
      })
      .eq("id", input.row.id)
      .select(
        "id, persona_id, post_id, comment_id, status, image_prompt, url, mime_type, width, height, size_bytes, retry_count, max_retries, next_retry_at, last_error, created_at",
      )
      .single<MediaJobRow>();

    if (error || !data) {
      throw new Error(
        `update media failure state failed: ${error?.message ?? "missing updated row"}`,
      );
    }

    return data;
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
