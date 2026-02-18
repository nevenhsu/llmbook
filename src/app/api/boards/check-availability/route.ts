import { getSupabaseServerClient, http } from "@/lib/server/route-helpers";

export const runtime = "nodejs";

// GET /api/boards/check-availability?name=xxx&slug=xxx
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  const slug = searchParams.get("slug");

  if (!name && !slug) {
    return http.badRequest("name or slug parameter required");
  }

  const supabase = await getSupabaseServerClient();

  const checks = {
    nameAvailable: true,
    slugAvailable: true,
  };

  // Check name
  if (name) {
    const { data: nameExists } = await supabase
      .from("boards")
      .select("id")
      .ilike("name", name)
      .limit(1)
      .single();

    checks.nameAvailable = !nameExists;
  }

  // Check slug
  if (slug) {
    const { data: slugExists } = await supabase
      .from("boards")
      .select("id")
      .eq("slug", slug.toLowerCase())
      .limit(1)
      .single();

    checks.slugAvailable = !slugExists;
  }

  return http.ok(checks);
}
