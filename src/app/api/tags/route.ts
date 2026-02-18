import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { http, parseJsonBody, withAuth } from "@/lib/server/route-helpers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");
  const limit = searchParams.get("limit");

  let query = supabase.from("tags").select("id, name, slug");

  // If searching, filter by name
  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  // Order by created_at desc (newest first)
  query = query.order("created_at", { ascending: false });

  // Apply limit (default 10 if not searching, no limit if searching)
  if (limit) {
    query = query.limit(parseInt(limit, 10));
  } else if (!search) {
    query = query.limit(10);
  }

  const { data, error } = await query;

  if (error) {
    return http.internalError(error.message);
  }

  return http.ok(data ?? []);
}

export const POST = withAuth(async (request, { supabase }) => {
  const body = await parseJsonBody<{ name?: unknown }>(request);
  if (body instanceof NextResponse) {
    return body;
  }

  const { name } = body;
  if (!name || typeof name !== "string") {
    return http.badRequest("Tag name is required");
  }

  const tagName = name.trim();
  if (!tagName) {
    return http.badRequest("Tag name is required");
  }

  // Validate tag name (English letters, numbers, hyphens, underscores only)
  if (!/^[a-zA-Z0-9_-]+$/.test(tagName)) {
    return http.badRequest(
      "Tag name can only contain English letters, numbers, hyphens, and underscores",
    );
  }

  // Create slug from name
  const slug = tagName.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  // Check if tag already exists
  const { data: existing, error: existingError } = await supabase
    .from("tags")
    .select("id, name, slug")
    .eq("name", tagName)
    .maybeSingle();

  if (existingError) {
    console.error("Failed to check existing tag:", existingError);
    return http.internalError("Failed to check existing tag");
  }

  if (existing) {
    return http.ok(existing);
  }

  // Create new tag
  const { data, error } = await supabase
    .from("tags")
    .insert({ name: tagName, slug })
    .select("id, name, slug")
    .single();

  if (error) {
    console.error("Failed to create tag:", error);
    return http.internalError(error.message);
  }

  return http.ok(data);
});
