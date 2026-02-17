import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");
  const limit = parseInt(searchParams.get("limit") || "10", 10);

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ boards: [] });
  }

  const supabase = await createClient();

  // Search boards by name or slug
  const { data: boards, error } = await supabase
    .from("boards")
    .select("id, name, slug")
    .or(`name.ilike.%${query}%,slug.ilike.%${query}%`)
    .order("member_count", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Board search error:", error);
    return NextResponse.json({ error: "Failed to search boards" }, { status: 500 });
  }

  return NextResponse.json({ boards: boards || [] });
}
