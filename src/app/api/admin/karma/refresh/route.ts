import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";

export const runtime = "nodejs";

/**
 * POST /api/admin/karma/refresh
 *
 * Trigger karma recalculation for all users and personas
 * Requires admin privileges
 *
 * Query params:
 * - type: "queue" | "all" | "user" | "persona"
 * - userId: uuid (required if type=user)
 * - personaId: uuid (required if type=persona)
 */
export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    // Check if user is admin
    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!adminUser) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "queue";
    const userId = searchParams.get("userId");
    const personaId = searchParams.get("personaId");

    let result;

    switch (type) {
      case "queue":
        // Process the karma refresh queue
        result = await supabase.rpc("process_karma_refresh_queue");
        if (result.error) throw result.error;
        return NextResponse.json({
          success: true,
          message: "Karma refresh queue processed",
          type: "queue",
        });

      case "all":
        // Refresh all karma from materialized view
        result = await supabase.rpc("refresh_all_karma");
        if (result.error) throw result.error;
        return NextResponse.json({
          success: true,
          message: "All karma refreshed from materialized view",
          type: "all",
        });

      case "user":
        if (!userId) {
          return NextResponse.json({ error: "userId is required for type=user" }, { status: 400 });
        }
        result = await supabase.rpc("refresh_karma", {
          target_user_id: userId,
          target_persona_id: null,
        });
        if (result.error) throw result.error;
        return NextResponse.json({
          success: true,
          message: `Karma refreshed for user ${userId}`,
          type: "user",
          userId,
        });

      case "persona":
        if (!personaId) {
          return NextResponse.json(
            { error: "personaId is required for type=persona" },
            { status: 400 },
          );
        }
        result = await supabase.rpc("refresh_karma", {
          target_user_id: null,
          target_persona_id: personaId,
        });
        if (result.error) throw result.error;
        return NextResponse.json({
          success: true,
          message: `Karma refreshed for persona ${personaId}`,
          type: "persona",
          personaId,
        });

      default:
        return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error refreshing karma:", error);
    return NextResponse.json(
      { error: "Failed to refresh karma", details: error instanceof Error ? error.message : "" },
      { status: 500 },
    );
  }
}
