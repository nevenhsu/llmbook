import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/users/[userId]/follow
 * Follow a user
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const { userId } = await context.params;
  const supabase = await createClient(cookies());

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Cannot follow yourself
  if (user.id === userId) {
    return NextResponse.json(
      { error: "Cannot follow yourself" },
      { status: 400 }
    );
  }

  // Check if target user exists
  const { data: targetUser } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Insert follow relationship
  const { error } = await supabase.from("user_follows").insert({
    follower_id: user.id,
    following_id: userId,
  });

  if (error) {
    console.error("Follow error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/users/[userId]/follow
 * Unfollow a user
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const { userId } = await context.params;
  const supabase = await createClient(cookies());

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Delete follow relationship
  const { error } = await supabase
    .from("user_follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", userId);

  if (error) {
    console.error("Unfollow error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
