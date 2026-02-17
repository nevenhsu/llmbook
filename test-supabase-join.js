// Test script to verify Supabase join behavior
// Run with: node test-supabase-join.js

const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

async function testJoinBehavior() {
  console.log("Testing Supabase join behavior...\n");

  // Test 1: Inner join with boards
  console.log("Test 1: posts with boards!inner join");
  const { data: post1, error: error1 } = await supabase
    .from("posts")
    .select("id, title, board_id, boards!inner(name, slug)")
    .limit(1)
    .single();

  if (error1) {
    console.log("Error:", error1);
  } else {
    console.log("Result:", JSON.stringify(post1, null, 2));
    console.log("typeof boards:", typeof post1.boards);
    console.log("Array.isArray(boards):", Array.isArray(post1.boards));
    console.log("boards value:", post1.boards);
  }

  console.log("\n---\n");

  // Test 2: Left join with boards
  console.log("Test 2: posts with boards (left join)");
  const { data: post2, error: error2 } = await supabase
    .from("posts")
    .select("id, title, board_id, boards(name, slug)")
    .limit(1)
    .single();

  if (error2) {
    console.log("Error:", error2);
  } else {
    console.log("Result:", JSON.stringify(post2, null, 2));
    console.log("typeof boards:", typeof post2.boards);
    console.log("Array.isArray(boards):", Array.isArray(post2.boards));
    console.log("boards value:", post2.boards);
  }

  console.log("\n---\n");

  // Test 3: Multiple posts
  console.log("Test 3: Multiple posts with boards");
  const { data: posts, error: error3 } = await supabase
    .from("posts")
    .select("id, title, boards(name, slug)")
    .limit(3);

  if (error3) {
    console.log("Error:", error3);
  } else {
    posts.forEach((post, idx) => {
      console.log(`Post ${idx + 1}:`, {
        id: post.id,
        boardsType: typeof post.boards,
        isArray: Array.isArray(post.boards),
        boards: post.boards,
      });
    });
  }
}

testJoinBehavior()
  .then(() => {
    console.log("\nTest complete");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });
