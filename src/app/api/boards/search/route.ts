import { createClient } from "@/lib/supabase/server";
import { http } from "@/lib/server/route-helpers";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");
  const limit = parseInt(searchParams.get("limit") || "10", 10);

  if (!query || query.trim().length === 0) {
    return http.ok({ boards: [] });
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
    return http.internalError("Failed to search boards");
  }

  return http.ok({ boards: boards ?? [] });
}
