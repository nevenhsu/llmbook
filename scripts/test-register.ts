/**
 * Test script for registration flow
 * Usage: npx tsx scripts/test-register.ts
 */

import { createClient } from "@supabase/supabase-js";
import { publicEnv, privateEnv } from "@/lib/env";

const supabase = createClient(publicEnv.supabaseUrl, privateEnv.supabaseServiceRoleKey);

async function testRegistration() {
  console.log("🧪 Testing registration flow...\n");

  const testUser = {
    email: `test_${Date.now()}@example.com`,
    password: "test123456",
    username: `testuser_${Date.now()}`,
  };

  console.log("📝 Test user data:");
  console.log(`  Email: ${testUser.email}`);
  console.log(`  Username: ${testUser.username}\n`);

  // Step 1: Sign up user
  console.log("1️⃣ Signing up user...");
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: testUser.email,
    password: testUser.password,
    options: {
      data: {
        username: testUser.username,
        display_name: testUser.username,
      },
    },
  });

  if (signUpError) {
    console.error("❌ Sign up failed:", signUpError.message);
    return;
  }

  if (!signUpData.user) {
    console.error("❌ No user returned from sign up");
    return;
  }

  console.log("✅ User signed up successfully");
  console.log(`   User ID: ${signUpData.user.id}\n`);

  // Step 2: Check if profile was created by trigger
  console.log("2️⃣ Checking if profile was created...");
  await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for trigger to execute

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", signUpData.user.id)
    .single();

  if (profileError) {
    console.error("❌ Profile not found:", profileError.message);

    // Check if trigger exists
    console.log("\n3️⃣ Checking if trigger exists...");
    const { data: triggers } = await supabase.rpc("exec_sql", {
      sql: `
        SELECT trigger_name, event_object_table, action_timing, event_manipulation
        FROM information_schema.triggers
        WHERE trigger_name = 'on_auth_user_created'
      `,
    });
    console.log("Triggers:", triggers);

    return;
  }

  console.log("✅ Profile created successfully");
  console.log(`   Username: ${profile.username}`);
  console.log(`   Display Name: ${profile.display_name}`);
  console.log(`   Created At: ${profile.created_at}\n`);

  // Step 3: Cleanup - Delete test user
  console.log("3️⃣ Cleaning up test user...");
  const { error: deleteError } = await supabase.auth.admin.deleteUser(signUpData.user.id);

  if (deleteError) {
    console.error("⚠️ Cleanup warning:", deleteError.message);
  } else {
    console.log("✅ Test user deleted\n");
  }

  console.log("✨ Registration test completed successfully!");
}

testRegistration().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
