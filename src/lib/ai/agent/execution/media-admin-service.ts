import { createAdminClient } from "@/lib/supabase/admin";
import type { AiAgentRecentMediaJobSnapshot } from "@/lib/ai/agent/read-models/overview-read-model";

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
  created_at: string;
};

type PersonaIdentityRow = {
  id: string;
  username: string | null;
  display_name: string | null;
};

export type AiAgentMediaJobListFilters = {
  limit?: number;
  status?: "all" | MediaJobStatus;
  query?: string;
};

export type AiAgentMediaJobsResponse = {
  jobs: AiAgentRecentMediaJobSnapshot[];
  summary: {
    pending: number;
    running: number;
    done: number;
    failed: number;
    total: number;
  };
  fetchedAt: string;
};

export type AiAgentMediaJobOwnerDetail = {
  ownerType: "post" | "comment" | "unknown";
  ownerId: string | null;
  postId: string | null;
  boardSlug: string | null;
  title: string | null;
  bodyPreview: string | null;
  status: string | null;
  path: string | null;
};

export type AiAgentMediaJobDetail = {
  job: AiAgentRecentMediaJobSnapshot;
  owner: AiAgentMediaJobOwnerDetail;
  fetchedAt: string;
};

type MediaAdminServiceDeps = {
  loadJobs: (filters: AiAgentMediaJobListFilters) => Promise<AiAgentRecentMediaJobSnapshot[]>;
  loadJobDetail: (id: string) => Promise<AiAgentMediaJobDetail>;
};

function summarizeJobs(jobs: AiAgentRecentMediaJobSnapshot[]): AiAgentMediaJobsResponse["summary"] {
  return jobs.reduce(
    (summary, job) => {
      summary.total += 1;
      switch (job.status) {
        case "PENDING_GENERATION":
          summary.pending += 1;
          break;
        case "RUNNING":
          summary.running += 1;
          break;
        case "DONE":
          summary.done += 1;
          break;
        case "FAILED":
          summary.failed += 1;
          break;
      }
      return summary;
    },
    { pending: 0, running: 0, done: 0, failed: 0, total: 0 },
  );
}

export class AiAgentMediaAdminService {
  private readonly deps: MediaAdminServiceDeps;

  public constructor(options?: { deps?: Partial<MediaAdminServiceDeps> }) {
    this.deps = {
      loadJobs: options?.deps?.loadJobs ?? ((filters) => this.readJobs(filters)),
      loadJobDetail: options?.deps?.loadJobDetail ?? ((id) => this.readJobDetail(id)),
    };
  }

  public async listRecentJobs(
    filters: AiAgentMediaJobListFilters = {},
  ): Promise<AiAgentMediaJobsResponse> {
    const jobs = await this.deps.loadJobs(filters);
    return {
      jobs,
      summary: summarizeJobs(jobs),
      fetchedAt: new Date().toISOString(),
    };
  }

  public async getJobDetail(id: string): Promise<AiAgentMediaJobDetail> {
    return this.deps.loadJobDetail(id);
  }

  private async readJobs(
    filters: AiAgentMediaJobListFilters,
  ): Promise<AiAgentRecentMediaJobSnapshot[]> {
    const supabase = createAdminClient();
    const safeLimit = Math.max(1, Math.min(filters.limit ?? 12, 50));
    let query = supabase
      .from("media")
      .select(
        "id, persona_id, post_id, comment_id, status, image_prompt, url, mime_type, width, height, size_bytes, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(safeLimit);

    if (filters.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }

    const { data, error } = await query.returns<MediaJobRow[]>();

    if (error) {
      throw new Error(`load media jobs failed: ${error.message}`);
    }

    const rows = data ?? [];
    const personaIds = Array.from(
      new Set(rows.map((row) => row.persona_id).filter((value): value is string => Boolean(value))),
    );

    let personaMap = new Map<string, PersonaIdentityRow>();
    if (personaIds.length > 0) {
      const { data: personaRows, error: personaError } = await supabase
        .from("personas")
        .select("id, username, display_name")
        .in("id", personaIds)
        .returns<PersonaIdentityRow[]>();

      if (personaError) {
        throw new Error(`load media job personas failed: ${personaError.message}`);
      }

      personaMap = new Map((personaRows ?? []).map((row) => [row.id, row]));
    }

    const mapped = rows.map((row) => {
      const persona = row.persona_id ? personaMap.get(row.persona_id) : null;
      return {
        id: row.id,
        personaId: row.persona_id,
        personaUsername: persona?.username ?? null,
        personaDisplayName: persona?.display_name ?? null,
        postId: row.post_id,
        commentId: row.comment_id,
        status: row.status,
        imagePrompt: row.image_prompt,
        url: row.url,
        mimeType: row.mime_type,
        width: row.width,
        height: row.height,
        sizeBytes: row.size_bytes,
        createdAt: row.created_at,
      };
    });

    const normalizedQuery = filters.query?.trim().toLowerCase() ?? "";
    if (!normalizedQuery) {
      return mapped;
    }

    return mapped.filter((job) =>
      [
        job.id,
        job.personaUsername,
        job.personaDisplayName,
        job.postId,
        job.commentId,
        job.imagePrompt,
        job.url,
        job.status,
      ]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(normalizedQuery)),
    );
  }

  private async readJobDetail(id: string): Promise<AiAgentMediaJobDetail> {
    const job = await this.readJobRow(id);
    if (!job) {
      throw new Error("media job not found");
    }

    return {
      job,
      owner: await this.readOwnerDetail(job),
      fetchedAt: new Date().toISOString(),
    };
  }

  private async readJobRow(id: string): Promise<AiAgentRecentMediaJobSnapshot | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("media")
      .select(
        "id, persona_id, post_id, comment_id, status, image_prompt, url, mime_type, width, height, size_bytes, created_at",
      )
      .eq("id", id)
      .maybeSingle<MediaJobRow>();

    if (error) {
      throw new Error(`load media job failed: ${error.message}`);
    }
    if (!data) {
      return null;
    }

    let persona: PersonaIdentityRow | null = null;
    if (data.persona_id) {
      const { data: personaRow, error: personaError } = await supabase
        .from("personas")
        .select("id, username, display_name")
        .eq("id", data.persona_id)
        .maybeSingle<PersonaIdentityRow>();
      if (personaError) {
        throw new Error(`load media job persona failed: ${personaError.message}`);
      }
      persona = personaRow ?? null;
    }

    return {
      id: data.id,
      personaId: data.persona_id,
      personaUsername: persona?.username ?? null,
      personaDisplayName: persona?.display_name ?? null,
      postId: data.post_id,
      commentId: data.comment_id,
      status: data.status,
      imagePrompt: data.image_prompt,
      url: data.url,
      mimeType: data.mime_type,
      width: data.width,
      height: data.height,
      sizeBytes: data.size_bytes,
      createdAt: data.created_at,
    };
  }

  private async readOwnerDetail(
    job: AiAgentRecentMediaJobSnapshot,
  ): Promise<AiAgentMediaJobOwnerDetail> {
    const supabase = createAdminClient();

    if (job.postId) {
      const { data, error } = await supabase
        .from("posts")
        .select("id, title, body, status, boards(slug)")
        .eq("id", job.postId)
        .maybeSingle<{
          id: string;
          title: string | null;
          body: string | null;
          status: string | null;
          boards: { slug: string | null } | { slug: string | null }[] | null;
        }>();

      if (error) {
        throw new Error(`load media owner post failed: ${error.message}`);
      }

      const board = Array.isArray(data?.boards) ? data?.boards[0] : data?.boards;
      return {
        ownerType: "post",
        ownerId: data?.id ?? job.postId,
        postId: data?.id ?? job.postId,
        boardSlug: board?.slug ?? null,
        title: data?.title ?? null,
        bodyPreview: truncatePreview(data?.body ?? null),
        status: data?.status ?? null,
        path: board?.slug && data?.id ? `/r/${board.slug}/posts/${data.id}` : null,
      };
    }

    if (job.commentId) {
      const { data, error } = await supabase
        .from("comments")
        .select("id, body, is_deleted, post_id, posts(id, title, boards(slug))")
        .eq("id", job.commentId)
        .maybeSingle<{
          id: string;
          body: string | null;
          is_deleted: boolean | null;
          post_id: string | null;
          posts:
            | {
                id: string;
                title: string | null;
                boards: { slug: string | null } | { slug: string | null }[] | null;
              }
            | {
                id: string;
                title: string | null;
                boards: { slug: string | null } | { slug: string | null }[] | null;
              }[]
            | null;
        }>();

      if (error) {
        throw new Error(`load media owner comment failed: ${error.message}`);
      }

      const post = Array.isArray(data?.posts) ? data?.posts[0] : data?.posts;
      const board = Array.isArray(post?.boards) ? post?.boards[0] : post?.boards;
      const postId = data?.post_id ?? post?.id ?? null;
      return {
        ownerType: "comment",
        ownerId: data?.id ?? job.commentId,
        postId,
        boardSlug: board?.slug ?? null,
        title: post?.title ?? null,
        bodyPreview: truncatePreview(data?.body ?? null),
        status: data?.is_deleted ? "DELETED" : "PUBLISHED",
        path:
          board?.slug && postId && (data?.id ?? job.commentId)
            ? `/r/${board.slug}/posts/${postId}#comment-${data?.id ?? job.commentId}`
            : null,
      };
    }

    return {
      ownerType: "unknown",
      ownerId: null,
      postId: null,
      boardSlug: null,
      title: null,
      bodyPreview: null,
      status: null,
      path: null,
    };
  }
}

function truncatePreview(value: string | null, limit = 180): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, limit - 1)}…`;
}
