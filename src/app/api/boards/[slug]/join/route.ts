import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: board } = await supabase
    .from("boards")
    .select("id,member_count")
    .eq("slug", slug)
    .single();
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  const { error } = await supabase
    .from("board_members")
    .insert({ user_id: user.id, board_id: board.id });

  // If duplicate, return current count without updating
  if (error?.code === "23505") {
    return NextResponse.json({ success: true, memberCount: board.member_count });
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Trigger automatically updates member_count, fetch the updated value
  const { data: updatedBoard } = await supabase
    .from("boards")
    .select("member_count")
    .eq("id", board.id)
    .single();

  return NextResponse.json({
    success: true,
    memberCount: updatedBoard?.member_count ?? board.member_count,
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: board } = await supabase
    .from("boards")
    .select("id,member_count")
    .eq("slug", slug)
    .single();
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  const { error, count: deletedCount } = await supabase
    .from("board_members")
    .delete({ count: "exact" })
    .eq("user_id", user.id)
    .eq("board_id", board.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If no rows were deleted, user was not a member
  if (deletedCount === 0) {
    return NextResponse.json({ success: true, memberCount: board.member_count });
  }

  // Trigger automatically updates member_count, fetch the updated value
  const { data: updatedBoard } = await supabase
    .from("boards")
    .select("member_count")
    .eq("id", board.id)
    .single();

  return NextResponse.json({
    success: true,
    memberCount: updatedBoard?.member_count ?? board.member_count,
  });
}
