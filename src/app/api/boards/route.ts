import { getSupabaseServerClient, withAuth, http, parseJsonBody } from "@/lib/server/route-helpers";
import { runInPostgresTransaction } from "@/lib/supabase/postgres";

export const runtime = "nodejs";

// GET /api/boards - List all boards
export async function GET(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { searchParams } = new URL(request.url);
  const includeArchived = searchParams.get("archived") === "true";

  let query = supabase
    .from("boards")
    .select(
      "id, slug, name, description, banner_url, member_count, post_count, created_at, is_archived, archived_at",
    )
    .order("name");

  if (!includeArchived) {
    query = query.eq("is_archived", false);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching boards:", error);
    return http.internalError();
  }

  return http.ok(data);
}

// POST /api/boards - Create a new board
export const POST = withAuth(async (request, { user, supabase }) => {
  const bodyResult = await parseJsonBody<{
    name: string;
    slug: string;
    description?: string;
    banner_url?: string;
    rules?: Array<{ title: string; description?: string }>;
  }>(request);

  if (bodyResult instanceof Response) return bodyResult;

  const { name, slug, description, banner_url, rules } = bodyResult;

  // Validation
  if (!name || !slug) {
    return http.badRequest("Missing required fields: name, slug");
  }

  if (name.length < 3 || name.length > 21) {
    return http.badRequest("Board name must be 3-21 characters");
  }

  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    return http.badRequest("Board name can only contain alphanumeric characters and underscores");
  }

  if (!/^[a-z0-9_]+$/.test(slug)) {
    return http.badRequest("Slug must be lowercase alphanumeric with underscores only");
  }

  if (description && description.length > 500) {
    return http.badRequest("Description must be max 500 characters");
  }

  if (rules && Array.isArray(rules)) {
    if (rules.length > 15) {
      return http.badRequest("Maximum 15 rules allowed");
    }

    for (const rule of rules) {
      if (!rule.title || rule.title.length > 100) {
        return http.badRequest("Rule title required and must be max 100 characters");
      }
      if (rule.description && rule.description.length > 500) {
        return http.badRequest("Rule description must be max 500 characters");
      }
    }
  }

  try {
    const board = await runInPostgresTransaction(async (tx) => {
      const boardRes = await tx.query(
        `insert into public.boards (name, slug, description, banner_url, rules)
         values ($1, $2, $3, $4, $5::jsonb)
         returning id, slug, name, description, banner_url, created_at`,
        [name, slug, description || null, banner_url || null, JSON.stringify(rules || [])],
      );

      const created = boardRes.rows[0] as
        | {
            id: string;
            slug: string;
            name: string;
            description: string | null;
            banner_url: string | null;
            created_at: string;
          }
        | undefined;

      if (!created) {
        throw new Error("Failed to create board");
      }

      await tx.query(
        `insert into public.board_moderators (board_id, user_id, role, permissions)
         values ($1, $2, 'owner', $3::jsonb)`,
        [
          created.id,
          user.id,
          JSON.stringify({
            manage_posts: true,
            manage_users: true,
            manage_settings: true,
          }),
        ],
      );

      await tx.query(
        `insert into public.board_members (board_id, user_id)
         values ($1, $2)`,
        [created.id, user.id],
      );

      return created;
    });

    return http.created({ board });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create board";
    if (message.toLowerCase().includes("duplicate key") || message.includes("23505")) {
      return http.conflict("Board slug already exists");
    }
    console.error("Error creating board:", error);
    return http.badRequest(message);
  }
});
