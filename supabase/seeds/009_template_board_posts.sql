-- Seed data for Phase 9: Template Board with Sample Posts
-- Run this in Supabase SQL Editor after running migration 008_boards_forum.sql
--
-- Creates:
-- - 1 Board: "Concept Art Gallery" with full configuration
-- - 1 Moderator: The first user (if exists) becomes owner
-- - 5 Sample Posts: 1 text, 2 image, 1 link, 1 poll
-- - Sample poll options
-- - Sample tags applied to posts

-- ============================================================================
-- STEP 1: Create the Template Board
-- ============================================================================

INSERT INTO public.boards (
  id,
  name,
  slug,
  description,
  banner_url,
  icon_url,
  rules,
  is_archived,
  member_count,
  post_count,
  created_at
)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Concept Art Gallery',
  'concept-art-gallery',
  'A community for sharing and discussing concept art, visual development, and creative explorations. Share your work, get feedback, and be inspired by fellow artists.',
  'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=1200&h=300&fit=crop',
  'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=200&h=200&fit=crop',
  '[
    {"title": "Be Respectful", "description": "Treat all community members with respect. No personal attacks, harassment, or discrimination."},
    {"title": "Credit Original Artists", "description": "Always credit the original artist when sharing work that is not your own."},
    {"title": "Constructive Feedback Only", "description": "When critiquing, focus on helpful suggestions rather than negative comments."},
    {"title": "No AI-Generated Art Without Disclosure", "description": "If posting AI-generated or AI-assisted art, clearly label it as such."},
    {"title": "Use Appropriate Flairs", "description": "Tag your posts with relevant categories to help others find content."}
  ]'::jsonb,
  false,
  0,
  5,
  now()
)
ON CONFLICT (slug) DO UPDATE SET
  description = EXCLUDED.description,
  rules = EXCLUDED.rules,
  banner_url = EXCLUDED.banner_url,
  icon_url = EXCLUDED.icon_url,
  updated_at = now();

-- ============================================================================
-- STEP 2: Create Sample Posts
-- ============================================================================

-- Note: These posts use a placeholder author_id. 
-- Replace 'YOUR_USER_ID_HERE' with an actual user ID from your auth.users table.
-- You can find user IDs with: SELECT id FROM auth.users LIMIT 1;

-- Helper: Create a temporary function to get a valid author_id
DO $$
DECLARE
  v_author_id uuid;
  v_board_id uuid := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  v_post_id_1 uuid := '10000001-0000-0000-0000-000000000001';
  v_post_id_2 uuid := '10000001-0000-0000-0000-000000000002';
  v_post_id_3 uuid := '10000001-0000-0000-0000-000000000003';
  v_post_id_4 uuid := '10000001-0000-0000-0000-000000000004';
  v_post_id_5 uuid := '10000001-0000-0000-0000-000000000005';
  v_feedback_tag uuid;
  v_draft_tag uuid;
  v_scifi_tag uuid;
  v_fantasy_tag uuid;
BEGIN
  -- Get the first user as author (or create one if none exist)
  SELECT user_id INTO v_author_id FROM public.profiles LIMIT 1;
  
  IF v_author_id IS NULL THEN
    RAISE NOTICE 'No users found. Please create a user account first, then run this script.';
    RETURN;
  END IF;

  -- Post 1: Text Post (Welcome/Introduction)
  INSERT INTO public.posts (id, author_id, board_id, title, body, post_type, status, created_at)
  VALUES (
    v_post_id_1,
    v_author_id,
    v_board_id,
    'Welcome to Concept Art Gallery! Read this first',
    '<h2>Welcome, Artists!</h2>
<p>This is your space to share concept art, get feedback, and connect with fellow creators.</p>
<h3>What to Post</h3>
<ul>
<li><strong>Original artwork</strong> - Share your concepts, sketches, and visual development work</li>
<li><strong>Process breakdowns</strong> - Show your workflow and techniques</li>
<li><strong>Inspiration collections</strong> - Curated moodboards with proper credits</li>
<li><strong>Questions &amp; discussions</strong> - Ask for advice or start conversations about the craft</li>
</ul>
<h3>Getting Started</h3>
<p>Introduce yourself in the comments! Tell us about your artistic journey and what you are working on.</p>',
    'text',
    'PUBLISHED',
    now() - interval '7 days'
  )
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;

  -- Post 2: Image Post (Character Concept)
  INSERT INTO public.posts (id, author_id, board_id, title, body, post_type, status, created_at)
  VALUES (
    v_post_id_2,
    v_author_id,
    v_board_id,
    'Sci-Fi Bounty Hunter - Character Design Sheet',
    '<p>Been working on this character for a personal project. She is a bounty hunter operating in the outer rim colonies.</p>
<p>Looking for feedback on:</p>
<ul>
<li>Silhouette readability</li>
<li>Color palette choices</li>
<li>Equipment design</li>
</ul>
<p>All feedback welcome!</p>',
    'image',
    'PUBLISHED',
    now() - interval '5 days'
  )
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;

  -- Post 3: Image Post (Environment Concept)
  INSERT INTO public.posts (id, author_id, board_id, title, body, post_type, status, created_at)
  VALUES (
    v_post_id_3,
    v_author_id,
    v_board_id,
    'Floating Market - Environment Concept',
    '<p>Environment concept for a fantasy world where cities float on clouds. This is the main marketplace district.</p>
<p>Inspired by Southeast Asian floating markets combined with steampunk aesthetics.</p>
<p>Painted in Photoshop, about 4 hours of work.</p>',
    'image',
    'PUBLISHED',
    now() - interval '3 days'
  )
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;

  -- Post 4: Link Post (Tutorial/Resource)
  INSERT INTO public.posts (id, author_id, board_id, title, body, post_type, link_url, status, created_at)
  VALUES (
    v_post_id_4,
    v_author_id,
    v_board_id,
    'Amazing color theory breakdown for concept artists',
    '<p>Found this incredibly helpful article on color theory specifically for concept art and visual development. Covers everything from mood to storytelling through color.</p>',
    'link',
    'https://www.creativebloq.com/colour/colour-theory-11121290',
    'PUBLISHED',
    now() - interval '2 days'
  )
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;

  -- Post 5: Poll Post
  INSERT INTO public.posts (id, author_id, board_id, title, body, post_type, status, created_at)
  VALUES (
    v_post_id_5,
    v_author_id,
    v_board_id,
    'What software do you primarily use for concept art?',
    '<p>Curious about what tools everyone is using! I have been considering switching from Photoshop and want to know what the community prefers.</p>',
    'poll',
    'PUBLISHED',
    now() - interval '1 day'
  )
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;

  -- Create poll options for Post 5
  INSERT INTO public.poll_options (id, post_id, text, position, vote_count)
  VALUES
    ('opt00001-0000-0000-0000-000000000001', v_post_id_5, 'Adobe Photoshop', 0, 12),
    ('opt00001-0000-0000-0000-000000000002', v_post_id_5, 'Procreate', 1, 8),
    ('opt00001-0000-0000-0000-000000000003', v_post_id_5, 'Clip Studio Paint', 2, 15),
    ('opt00001-0000-0000-0000-000000000004', v_post_id_5, 'Krita (Free)', 3, 5),
    ('opt00001-0000-0000-0000-000000000005', v_post_id_5, 'Blender (3D)', 4, 3)
  ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text;

  -- Add the author as board owner
  INSERT INTO public.board_moderators (board_id, user_id, role, permissions)
  VALUES (
    v_board_id,
    v_author_id,
    'owner',
    '{"manage_posts": true, "manage_users": true, "manage_settings": true}'::jsonb
  )
  ON CONFLICT (board_id, user_id) DO UPDATE SET role = 'owner';

  -- Auto-join the author to the board
  INSERT INTO public.board_members (user_id, board_id)
  VALUES (v_author_id, v_board_id)
  ON CONFLICT (user_id, board_id) DO NOTHING;

  RAISE NOTICE 'Template data created successfully!';
  RAISE NOTICE 'Board: Concept Art Gallery (/boards/concept-art-gallery)';
  RAISE NOTICE 'Posts created: 5 (1 text, 2 image, 1 link, 1 poll)';
  RAISE NOTICE 'Board owner: %', v_author_id;

  -- ============================================================================
  -- STEP 3: Apply Tags to Posts
  -- ============================================================================

  -- Get tag IDs (these should exist from original schema.sql)
  SELECT id INTO v_feedback_tag FROM public.tags WHERE slug = 'feedback';
  SELECT id INTO v_draft_tag FROM public.tags WHERE slug = 'draft';
  SELECT id INTO v_scifi_tag FROM public.tags WHERE slug = 'sci-fi';
  SELECT id INTO v_fantasy_tag FROM public.tags WHERE slug = 'fantasy';

  -- Apply tags to posts
  IF v_feedback_tag IS NOT NULL THEN
    INSERT INTO public.post_tags (post_id, tag_id)
    VALUES 
      (v_post_id_2, v_feedback_tag),
      (v_post_id_3, v_feedback_tag)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_scifi_tag IS NOT NULL THEN
    INSERT INTO public.post_tags (post_id, tag_id)
    VALUES (v_post_id_2, v_scifi_tag)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_fantasy_tag IS NOT NULL THEN
    INSERT INTO public.post_tags (post_id, tag_id)
    VALUES (v_post_id_3, v_fantasy_tag)
    ON CONFLICT DO NOTHING;
  END IF;

  RAISE NOTICE 'Tags applied to posts successfully!';

END $$;

-- ============================================================================
-- VERIFICATION QUERIES (optional, run to verify data)
-- ============================================================================

-- Check board was created:
-- SELECT * FROM public.boards WHERE slug = 'concept-art-gallery';

-- Check posts were created:
-- SELECT id, title, post_type, created_at FROM public.posts WHERE board_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' ORDER BY created_at;

-- Check poll options:
-- SELECT * FROM public.poll_options WHERE post_id = '10000001-0000-0000-0000-000000000005';

-- Check moderators:
-- SELECT bm.*, p.display_name FROM public.board_moderators bm JOIN public.profiles p ON bm.user_id = p.user_id;
