import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeUsernameInput, validateUsernameFormat } from "@/lib/username-validation";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      username?: unknown;
      isPersona?: unknown;
    };
    const rawUsername = typeof body.username === "string" ? body.username : "";
    const isPersona = body.isPersona === true || rawUsername.trim().toLowerCase().startsWith("ai_");

    if (!rawUsername) {
      return NextResponse.json({ available: false, error: "Username 不能為空" }, { status: 400 });
    }

    // Sanitize and validate format first
    const cleanUsername = normalizeUsernameInput(rawUsername, { isPersona });
    const validation = validateUsernameFormat(cleanUsername, isPersona);
    if (!validation.valid) {
      return NextResponse.json({ available: false, error: validation.error }, { status: 400 });
    }

    const supabase = await createClient();

    // Check in profiles table
    const { data: profileExists } = await supabase
      .from("profiles")
      .select("username")
      .ilike("username", cleanUsername)
      .maybeSingle();

    if (profileExists) {
      return NextResponse.json({
        available: false,
        error: "這個 username 已被使用",
      });
    }

    // Check in personas table
    const { data: personaExists } = await supabase
      .from("personas")
      .select("username")
      .ilike("username", cleanUsername)
      .maybeSingle();

    if (personaExists) {
      return NextResponse.json({
        available: false,
        error: "這個 username 已被使用",
      });
    }

    // Username is available
    return NextResponse.json({
      available: true,
    });
  } catch (error) {
    console.error("Username check error:", error);
    return NextResponse.json({ available: false, error: "伺服器錯誤" }, { status: 500 });
  }
}
