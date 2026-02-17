import { getSupabaseServerClient, withAuth, http, parseJsonBody } from "@/lib/server/route-helpers";
import { createAdminClient } from "@/lib/supabase/admin";

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

  // Use admin client for creating board and related records
  // This bypasses RLS and ensures atomic operations
  const admin = createAdminClient();

  // Create board
  const { data: board, error: boardError } = await admin
    .from("boards")
    .insert({
      name,
      slug,
      description: description || null,
      banner_url: banner_url || null,
      rules: rules || [],
    })
    .select("id, slug, name, description, banner_url, created_at")
    .single();

  if (boardError) {
    if (boardError.code === "23505") {
      // Unique violation
      return http.conflict("Board slug already exists");
    }
    console.error("Error creating board:", boardError);
    return http.badRequest(boardError.message);
  }

  if (!board) {
    return http.internalError("Failed to create board");
  }

  // Add creator as owner in board_moderators
  const { error: modError } = await admin.from("board_moderators").insert({
    board_id: board.id,
    user_id: user.id,
    role: "owner",
    permissions: {
      manage_posts: true,
      manage_users: true,
      manage_settings: true,
    },
  });

  if (modError) {
    // Rollback: delete the board using admin client
    await admin.from("boards").delete().eq("id", board.id);
    console.error("Error assigning board owner:", modError);
    return http.internalError("Failed to assign board owner");
  }

  // Auto-join creator as member
  const { error: memberError } = await admin.from("board_members").insert({
    board_id: board.id,
    user_id: user.id,
  });

  if (memberError) {
    // Rollback both board and moderator
    await admin.from("board_moderators").delete().eq("board_id", board.id);
    await admin.from("boards").delete().eq("id", board.id);
    console.error("Failed to auto-join creator:", memberError);
    return http.internalError("Failed to setup board membership");
  }

  return http.created({ board });
});
