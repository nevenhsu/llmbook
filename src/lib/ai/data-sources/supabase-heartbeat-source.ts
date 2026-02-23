import { createAdminClient } from "@/lib/supabase/admin";

export type HeartbeatEventSourceName =
  | "notifications"
  | "posts"
  | "comments"
  | "votes"
  | "poll_votes";

export type HeartbeatEvent = {
  sourceName: HeartbeatEventSourceName;
  sourceId: string;
  createdAt: string;
  payload: Record<string, unknown>;
};

export type HeartbeatCheckpoint = {
  sourceName: HeartbeatEventSourceName;
  lastCapturedAt: Date;
  safetyOverlapSeconds: number;
};

const DEFAULT_OVERLAP_SECONDS = 10;

export class SupabaseHeartbeatSource {
  public async getCheckpoint(sourceName: HeartbeatEventSourceName): Promise<HeartbeatCheckpoint> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("heartbeat_checkpoints")
      .select("source_name, last_captured_at, safety_overlap_seconds")
      .eq("source_name", sourceName)
      .maybeSingle<{
        source_name: HeartbeatEventSourceName;
        last_captured_at: string;
        safety_overlap_seconds: number;
      }>();

    if (error) {
      throw new Error(`get checkpoint failed for ${sourceName}: ${error.message}`);
    }

    if (!data) {
      const created = await this.upsertCheckpoint({
        sourceName,
        lastCapturedAt: new Date("1970-01-01T00:00:00.000Z"),
        safetyOverlapSeconds: DEFAULT_OVERLAP_SECONDS,
      });
      return created;
    }

    return {
      sourceName: data.source_name,
      lastCapturedAt: new Date(data.last_captured_at),
      safetyOverlapSeconds: data.safety_overlap_seconds,
    };
  }

  public async upsertCheckpoint(input: HeartbeatCheckpoint): Promise<HeartbeatCheckpoint> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("heartbeat_checkpoints")
      .upsert({
        source_name: input.sourceName,
        last_captured_at: input.lastCapturedAt.toISOString(),
        safety_overlap_seconds: input.safetyOverlapSeconds,
        updated_at: new Date().toISOString(),
      })
      .select("source_name, last_captured_at, safety_overlap_seconds")
      .single<{
        source_name: HeartbeatEventSourceName;
        last_captured_at: string;
        safety_overlap_seconds: number;
      }>();

    if (error) {
      throw new Error(`upsert checkpoint failed for ${input.sourceName}: ${error.message}`);
    }

    return {
      sourceName: data.source_name,
      lastCapturedAt: new Date(data.last_captured_at),
      safetyOverlapSeconds: data.safety_overlap_seconds,
    };
  }

  public async fetchRecentEvents(sourceName: HeartbeatEventSourceName): Promise<HeartbeatEvent[]> {
    const checkpoint = await this.getCheckpoint(sourceName);
    const overlapStart = new Date(
      checkpoint.lastCapturedAt.getTime() - checkpoint.safetyOverlapSeconds * 1000,
    ).toISOString();

    const supabase = createAdminClient();

    switch (sourceName) {
      case "notifications": {
        const { data, error } = await supabase
          .from("notifications")
          .select("id, type, payload, created_at")
          .gte("created_at", overlapStart)
          .order("created_at", { ascending: true });

        if (error) throw new Error(`fetch notifications failed: ${error.message}`);

        return (data ?? []).map((row: any) => ({
          sourceName,
          sourceId: row.id,
          createdAt: row.created_at,
          payload: { type: row.type, ...(row.payload ?? {}) },
        }));
      }
      case "posts": {
        const { data, error } = await supabase
          .from("posts")
          .select("id, board_id, author_id, persona_id, title, created_at")
          .gte("created_at", overlapStart)
          .order("created_at", { ascending: true });

        if (error) throw new Error(`fetch posts failed: ${error.message}`);

        return (data ?? []).map((row: any) => ({
          sourceName,
          sourceId: row.id,
          createdAt: row.created_at,
          payload: {
            boardId: row.board_id,
            authorId: row.author_id,
            personaId: row.persona_id,
            title: row.title,
          },
        }));
      }
      case "comments": {
        const { data, error } = await supabase
          .from("comments")
          .select("id, post_id, parent_id, author_id, persona_id, body, created_at")
          .gte("created_at", overlapStart)
          .order("created_at", { ascending: true });

        if (error) throw new Error(`fetch comments failed: ${error.message}`);

        return (data ?? []).map((row: any) => ({
          sourceName,
          sourceId: row.id,
          createdAt: row.created_at,
          payload: {
            postId: row.post_id,
            parentId: row.parent_id,
            authorId: row.author_id,
            personaId: row.persona_id,
            body: row.body,
          },
        }));
      }
      case "votes": {
        const { data, error } = await supabase
          .from("votes")
          .select("id, post_id, comment_id, value, user_id, persona_id, created_at")
          .gte("created_at", overlapStart)
          .order("created_at", { ascending: true });

        if (error) throw new Error(`fetch votes failed: ${error.message}`);

        return (data ?? []).map((row: any) => ({
          sourceName,
          sourceId: row.id,
          createdAt: row.created_at,
          payload: {
            postId: row.post_id,
            commentId: row.comment_id,
            value: row.value,
            userId: row.user_id,
            personaId: row.persona_id,
          },
        }));
      }
      case "poll_votes": {
        const { data, error } = await supabase
          .from("poll_votes")
          .select("id, post_id, option_id, user_id, created_at")
          .gte("created_at", overlapStart)
          .order("created_at", { ascending: true });

        if (error) throw new Error(`fetch poll_votes failed: ${error.message}`);

        return (data ?? []).map((row: any) => ({
          sourceName,
          sourceId: row.id,
          createdAt: row.created_at,
          payload: {
            postId: row.post_id,
            optionId: row.option_id,
            userId: row.user_id,
          },
        }));
      }
      default:
        return [];
    }
  }
}
