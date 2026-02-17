import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";

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
    return new NextResponse(error.message, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const user = await getUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string") {
      return new NextResponse("Tag name is required", { status: 400 });
    }

    const tagName = name.trim();

    // Validate tag name (English letters, numbers, hyphens, underscores only)
    if (!/^[a-zA-Z0-9_-]+$/.test(tagName)) {
      return new NextResponse(
        "Tag name can only contain English letters, numbers, hyphens, and underscores",
        { status: 400 },
      );
    }

    // Create slug from name
    const slug = tagName.toLowerCase().replace(/[^a-z0-9-]/g, "-");

    const supabase = await createClient();

    // Check if tag already exists
    const { data: existing } = await supabase
      .from("tags")
      .select("id, name, slug")
      .eq("name", tagName)
      .single();

    if (existing) {
      // Return existing tag if it already exists
      return NextResponse.json(existing);
    }

    // Create new tag
    const { data, error } = await supabase
      .from("tags")
      .insert({ name: tagName, slug })
      .select("id, name, slug")
      .single();

    if (error) {
      console.error("Failed to create tag:", error);
      return new NextResponse(error.message, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error creating tag:", error);
    return new NextResponse(error.message || "Internal server error", { status: 500 });
  }
}
