import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { http } from "@/lib/server/route-helpers";
import { validateUsernameFormat, sanitizeUsername } from "@/lib/username-validation";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { email, password, username } = await request.json();

    // Validate input
    if (!email || !password || !username) {
      return http.badRequest("缺少必要欄位");
    }

    // Sanitize and validate username format
    const cleanUsername = sanitizeUsername(username);
    const usernameValidation = validateUsernameFormat(cleanUsername, false);
    if (!usernameValidation.valid) {
      return http.badRequest(usernameValidation.error);
    }

    // Check password length
    if (password.length < 6) {
      return http.badRequest("密碼長度至少需要 6 個字元");
    }

    const adminClient = createAdminClient();

    // Check if username is already taken
    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("username")
      .ilike("username", cleanUsername)
      .single();

    if (existingProfile) {
      return http.conflict("Username 已被使用");
    }

    // Sign up user with metadata
    const { data, error: signUpError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        username: cleanUsername,
        display_name: cleanUsername,
      },
    });

    if (signUpError) {
      console.error("Sign up error:", signUpError);
      return http.badRequest(signUpError.message);
    }

    if (!data.user) {
      return http.internalError("註冊失敗");
    }

    // Create profile manually
    const { error: profileError } = await adminClient.from("profiles").insert({
      user_id: data.user.id,
      username: cleanUsername,
      display_name: cleanUsername,
    });

    if (profileError) {
      console.error("Profile creation error:", profileError);

      // Rollback: Delete the user if profile creation fails
      await adminClient.auth.admin.deleteUser(data.user.id);

      return http.internalError("建立使用者資料失敗，請重試");
    }

    // Sign in the user using server client to set cookies
    // Wait a moment for the user to be fully created
    await new Promise((resolve) => setTimeout(resolve, 100));

    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      console.error("Sign in error:", signInError);
      // User is created successfully, just can't auto-login
      return http.ok({
        success: true,
        user: {
          id: data.user.id,
          email: data.user.email,
          username: cleanUsername,
        },
        needsManualLogin: true,
        message: "註冊成功！請使用您的帳號登入。",
      });
    }

    return http.ok({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        username: cleanUsername,
      },
      message: "註冊成功！",
    });
  } catch (error: unknown) {
    console.error("Register API error:", error);

    const message = error instanceof Error ? error.message : "註冊時發生錯誤";
    return http.internalError(message);
  }
}
