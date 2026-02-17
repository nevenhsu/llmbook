import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Login API - Supports email or username
 * POST /api/auth/login
 */
export async function POST(request: NextRequest) {
  try {
    const { identifier, password } = await request.json();

    // Validate input
    if (!identifier || !password) {
      return NextResponse.json({ error: "請輸入 Email/Username 和密碼" }, { status: 400 });
    }

    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Check if identifier is email or username
    const isEmail = identifier.includes("@");
    let email = identifier;

    // If it's a username, look up the email
    if (!isEmail) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id")
        .ilike("username", identifier.trim().toLowerCase())
        .single();

      if (profileError || !profile) {
        return NextResponse.json({ error: "Username 或密碼錯誤" }, { status: 401 });
      }

      // Get email from auth.users using admin client
      const {
        data: { user },
        error: userError,
      } = await adminClient.auth.admin.getUserById(profile.user_id);

      if (userError || !user?.email) {
        return NextResponse.json({ error: "Username 或密碼錯誤" }, { status: 401 });
      }

      email = user.email;
    }

    // Sign in with email and password
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      return NextResponse.json({ error: "Email/Username 或密碼錯誤" }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
      message: "登入成功！",
    });
  } catch (error: any) {
    console.error("Login API error:", error);
    return NextResponse.json({ error: error.message || "登入時發生錯誤" }, { status: 500 });
  }
}
