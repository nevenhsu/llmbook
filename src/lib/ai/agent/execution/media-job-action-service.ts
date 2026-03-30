import {
  AiAgentMediaAdminService,
  type AiAgentMediaJobDetail,
} from "@/lib/ai/agent/execution/media-admin-service";
import { AiAgentMediaJobService } from "@/lib/ai/agent/execution/media-job-service";

export type AiAgentMediaJobActionName = "retry_generation";
export type AiAgentMediaJobActionReasonCode =
  | "RETRY_READY"
  | "DONE_ROW"
  | "ACTIVE_ROW"
  | "MISSING_PERSONA"
  | "MISSING_OWNER_LINKAGE"
  | "MISSING_IMAGE_PROMPT";

export type AiAgentMediaJobActionPreview = {
  action: AiAgentMediaJobActionName;
  enabled: boolean;
  reason: string;
  reasonCode: AiAgentMediaJobActionReasonCode;
  statusTransition: {
    from: "PENDING_GENERATION" | "RUNNING" | "DONE" | "FAILED";
    to: "RUNNING" | "DONE" | "FAILED";
  };
  payload: {
    media_id: string;
    owner_id: string | null;
    owner_type: "post" | "comment" | "unknown";
    image_prompt: string | null;
  };
};

export type AiAgentMediaJobActionPreviewResponse = {
  mode: "preview";
  mediaId: string;
  action: AiAgentMediaJobActionName;
  actionPreview: AiAgentMediaJobActionPreview;
  message: string;
};

export type AiAgentMediaJobActionExecutedResponse = {
  mode: "executed";
  mediaId: string;
  action: AiAgentMediaJobActionName;
  actionPreview: AiAgentMediaJobActionPreview;
  updatedDetail: AiAgentMediaJobDetail;
  message: string;
};

export type AiAgentMediaJobActionBlockedResponse = {
  mode: "blocked_execute";
  mediaId: string;
  action: AiAgentMediaJobActionName;
  actionPreview: AiAgentMediaJobActionPreview;
  message: string;
};

type MediaJobActionServiceDeps = {
  getJobDetail: (mediaId: string) => Promise<AiAgentMediaJobDetail>;
  rerunJobById: (mediaId: string) => Promise<void>;
};

export class AiAgentMediaJobActionBlockedError extends Error {
  public readonly response: AiAgentMediaJobActionBlockedResponse;

  public constructor(response: AiAgentMediaJobActionBlockedResponse) {
    super(response.message);
    this.name = "AiAgentMediaJobActionBlockedError";
    this.response = response;
  }
}

function buildRetryPreview(detail: AiAgentMediaJobDetail): AiAgentMediaJobActionPreview {
  const from = detail.job.status;
  const ownerType = detail.owner.ownerType;
  const ownerId = detail.owner.ownerId;
  const imagePrompt = detail.job.imagePrompt;

  if (from === "DONE") {
    return {
      action: "retry_generation",
      enabled: false,
      reason: "Retry is not allowed for completed media rows.",
      reasonCode: "DONE_ROW",
      statusTransition: { from, to: "DONE" },
      payload: {
        media_id: detail.job.id,
        owner_id: ownerId,
        owner_type: ownerType,
        image_prompt: imagePrompt,
      },
    };
  }

  if (from === "RUNNING") {
    return {
      action: "retry_generation",
      enabled: false,
      reason: "Retry is blocked while the media row is already RUNNING.",
      reasonCode: "ACTIVE_ROW",
      statusTransition: { from, to: "RUNNING" },
      payload: {
        media_id: detail.job.id,
        owner_id: ownerId,
        owner_type: ownerType,
        image_prompt: imagePrompt,
      },
    };
  }

  if (!detail.job.personaId) {
    return {
      action: "retry_generation",
      enabled: false,
      reason: "Retry requires a persisted persona id on the media row.",
      reasonCode: "MISSING_PERSONA",
      statusTransition: { from, to: "FAILED" },
      payload: {
        media_id: detail.job.id,
        owner_id: ownerId,
        owner_type: ownerType,
        image_prompt: imagePrompt,
      },
    };
  }

  if (ownerType === "unknown") {
    return {
      action: "retry_generation",
      enabled: false,
      reason: "Retry requires owner linkage to a post or comment.",
      reasonCode: "MISSING_OWNER_LINKAGE",
      statusTransition: { from, to: "FAILED" },
      payload: {
        media_id: detail.job.id,
        owner_id: ownerId,
        owner_type: ownerType,
        image_prompt: imagePrompt,
      },
    };
  }

  if (!imagePrompt?.trim()) {
    return {
      action: "retry_generation",
      enabled: false,
      reason: "Retry requires a persisted image prompt.",
      reasonCode: "MISSING_IMAGE_PROMPT",
      statusTransition: { from, to: "FAILED" },
      payload: {
        media_id: detail.job.id,
        owner_id: ownerId,
        owner_type: ownerType,
        image_prompt: imagePrompt,
      },
    };
  }

  return {
    action: "retry_generation",
    enabled: true,
    reason:
      "Retry will regenerate the asset and overwrite the current media metadata on the selected row.",
    reasonCode: "RETRY_READY",
    statusTransition: { from, to: "DONE" },
    payload: {
      media_id: detail.job.id,
      owner_id: ownerId,
      owner_type: ownerType,
      image_prompt: imagePrompt,
    },
  };
}

export class AiAgentMediaJobActionService {
  private readonly deps: MediaJobActionServiceDeps;

  public constructor(options?: { deps?: Partial<MediaJobActionServiceDeps> }) {
    this.deps = {
      getJobDetail:
        options?.deps?.getJobDetail ??
        ((mediaId) => new AiAgentMediaAdminService().getJobDetail(mediaId)),
      rerunJobById:
        options?.deps?.rerunJobById ??
        ((mediaId) => new AiAgentMediaJobService().rerunJobById(mediaId).then(() => undefined)),
    };
  }

  public async previewAction(mediaId: string): Promise<AiAgentMediaJobActionPreviewResponse> {
    const detail = await this.deps.getJobDetail(mediaId);
    const actionPreview = buildRetryPreview(detail);
    return {
      mode: "preview",
      mediaId,
      action: "retry_generation",
      actionPreview,
      message: actionPreview.reason,
    };
  }

  public async executeAction(mediaId: string): Promise<AiAgentMediaJobActionExecutedResponse> {
    const preview = await this.previewAction(mediaId);
    if (!preview.actionPreview.enabled) {
      throw new AiAgentMediaJobActionBlockedError({
        mode: "blocked_execute",
        mediaId,
        action: "retry_generation",
        actionPreview: preview.actionPreview,
        message: preview.actionPreview.reason,
      });
    }

    await this.deps.rerunJobById(mediaId);
    const updatedDetail = await this.deps.getJobDetail(mediaId);

    return {
      mode: "executed",
      mediaId,
      action: "retry_generation",
      actionPreview: preview.actionPreview,
      updatedDetail,
      message: "retry_generation executed against media.",
    };
  }
}
