-- Create Test User Profile and Posts for Concept Art Gallery
-- This script:
-- 1. Creates a profile for the test user
-- 2. Inserts 5 sample posts into Concept Art Gallery board
--
-- Test User ID: e2903097-41a3-442e-a6fe-82f6cec4a532
-- Board ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890

DO $$
DECLARE
  v_author_id uuid := 'e2903097-41a3-442e-a6fe-82f6cec4a532';
  v_board_id uuid := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  v_post_id_1 uuid := gen_random_uuid();
  v_post_id_2 uuid := gen_random_uuid();
  v_post_id_3 uuid := gen_random_uuid();
  v_post_id_4 uuid := gen_random_uuid();
  v_post_id_5 uuid := gen_random_uuid();
BEGIN
  -- ============================================================================
  -- STEP 1: Create Profile for Test User (if not exists)
  -- ============================================================================
  INSERT INTO public.profiles (user_id, display_name, bio, created_at)
  VALUES (
    v_author_id,
    'Test Artist',
    'Concept artist and digital painter exploring cyberpunk and fantasy themes.',
    now()
  )
  ON CONFLICT (user_id) DO UPDATE 
  SET display_name = EXCLUDED.display_name,
      bio = EXCLUDED.bio;

  RAISE NOTICE 'Profile created/updated for user: %', v_author_id;

  -- Verify board exists
  IF NOT EXISTS (SELECT 1 FROM public.boards WHERE id = v_board_id) THEN
    RAISE EXCEPTION 'Board with ID % does not exist', v_board_id;
  END IF;

  -- ============================================================================
  -- STEP 2: Create Posts
  -- ============================================================================

  -- Post 1: Cyberpunk Street Scene - Image Post
  INSERT INTO public.posts (
    id, 
    author_id, 
    board_id, 
    title, 
    body, 
    post_type, 
    status, 
    created_at
  )
  VALUES (
    v_post_id_1,
    v_author_id,
    v_board_id,
    'Neon Rain - Cyberpunk Street Scene WIP',
    '<p>Working on this cyberpunk street scene for my portfolio. Trying to capture that rainy, neon-soaked atmosphere.</p>
<h3>Process:</h3>
<ul>
<li>Started with grayscale block-in to establish composition</li>
<li>Added color grading and neon lights</li>
<li>Still working on foreground character details</li>
</ul>
<p><strong>Looking for feedback on:</strong></p>
<ul>
<li>Does the focal point read clearly?</li>
<li>Any issues with perspective?</li>
<li>Color balance - too saturated?</li>
</ul>
<p>This is about 6 hours of work so far. Planning to add more atmospheric details and refine the lighting.</p>',
    'image',
    'PUBLISHED',
    now() - interval '12 hours'
  );

  -- Post 2: Fantasy Weapon Designs - Image Post
  INSERT INTO public.posts (
    id, 
    author_id, 
    board_id, 
    title, 
    body, 
    post_type, 
    status, 
    created_at
  )
  VALUES (
    v_post_id_2,
    v_author_id,
    v_board_id,
    'Elemental Blade Concepts - Which design works best?',
    '<p>Designing a legendary sword for a fantasy game project. The weapon channels elemental magic and transforms based on which element the player chooses.</p>
<p>I created 4 variations:</p>
<ol>
<li><strong>Fire:</strong> Molten metal with ember particles</li>
<li><strong>Ice:</strong> Crystalline blade with frost trails</li>
<li><strong>Lightning:</strong> Crackling energy blade</li>
<li><strong>Earth:</strong> Stone and vine fusion design</li>
</ol>
<p>Which design resonates most with you? Would love to hear your thoughts on readability and visual appeal!</p>
<p><em>Created in Procreate, about 3 hours total.</em></p>',
    'image',
    'PUBLISHED',
    now() - interval '2 days'
  );

  -- Post 3: Creature Design Study - Text Post
  INSERT INTO public.posts (
    id, 
    author_id, 
    board_id, 
    title, 
    body, 
    post_type, 
    status, 
    created_at
  )
  VALUES (
    v_post_id_3,
    v_author_id,
    v_board_id,
    'Tips for creating believable creature designs',
    '<h2>What I''ve learned from studying creature design</h2>
<p>After spending months studying creature design from masters like Terryl Whitlatch and Aaron Sims, here are my key takeaways:</p>

<h3>1. Start with Real Anatomy</h3>
<p>Even the most fantastical creatures need a foundation in real anatomy. Study how actual animals move, how their skeletons work, where muscles attach. This knowledge will make your fantasy creatures feel grounded and believable.</p>

<h3>2. Function Drives Form</h3>
<p>Ask yourself: Where does this creature live? What does it eat? How does it defend itself? These questions should inform every design choice you make.</p>

<h3>3. Asymmetry Creates Interest</h3>
<p>Perfect symmetry can look boring or artificial. Add subtle asymmetries - a scar, different horn sizes, weathering on one side. These details suggest history and make creatures feel lived-in.</p>

<h3>4. Silhouette is King</h3>
<p>If your creature doesn''t read well as a black silhouette, the design needs work. The silhouette should communicate the creature''s purpose and personality instantly.</p>

<h3>5. Reference, Reference, Reference</h3>
<p>I keep massive reference libraries organized by animal type, environment, and texture. You can''t create from imagination alone - even fantasy needs real-world anchors.</p>

<p><strong>What are your go-to creature design tips? Drop them in the comments!</strong></p>',
    'text',
    'PUBLISHED',
    now() - interval '4 days'
  );

  -- Post 4: Architecture Speedpaints - Link Post
  INSERT INTO public.posts (
    id, 
    author_id, 
    board_id, 
    title, 
    body, 
    post_type, 
    link_url,
    status, 
    created_at
  )
  VALUES (
    v_post_id_4,
    v_author_id,
    v_board_id,
    'Incredible architecture speedpaint tutorial by FengZhu',
    '<p>Just found this masterclass on environment concept speedpainting from FengZhu Design School.</p>
<p>Key techniques covered:</p>
<ul>
<li>Establishing perspective grids quickly</li>
<li>Using photo textures efficiently</li>
<li>Creating depth through atmospheric perspective</li>
<li>When to detail vs when to suggest</li>
</ul>
<p>Even though it''s from a few years ago, the fundamentals are timeless. If you''re working on environment concepts, this is a must-watch.</p>
<p><strong>What''s your favorite architecture/environment tutorial?</strong></p>',
    'link',
    'https://www.youtube.com/watch?v=0cK_93OHpzY',
    'PUBLISHED',
    now() - interval '6 days'
  );

  -- Post 5: Color Palette Discussion - Poll Post
  INSERT INTO public.posts (
    id, 
    author_id, 
    board_id, 
    title, 
    body, 
    post_type, 
    status, 
    created_at
  )
  VALUES (
    v_post_id_5,
    v_author_id,
    v_board_id,
    'What''s your preferred method for establishing color palettes?',
    '<p>I''m curious how other artists approach color selection for concept work. There are so many different workflows!</p>
<p>Some artists swear by working in grayscale first, others jump straight into color. Some use color scripts, others use photo references.</p>
<p><strong>Vote for your primary approach and share your reasoning in the comments!</strong></p>
<p><em>I''m working on a tutorial series about color theory and want to cover the most popular workflows.</em></p>',
    'poll',
    'PUBLISHED',
    now() - interval '8 days'
  );

  -- Create poll options for Post 5
  INSERT INTO public.poll_options (post_id, text, position, vote_count)
  VALUES
    (v_post_id_5, 'Grayscale first, then color overlay', 0, 0),
    (v_post_id_5, 'Direct color painting from start', 1, 0),
    (v_post_id_5, 'Color thumbnails/studies first', 2, 0),
    (v_post_id_5, 'Reference photo color picking', 3, 0),
    (v_post_id_5, 'Limited palette/color script approach', 4, 0);

  -- Update board post count
  UPDATE public.boards 
  SET post_count = post_count + 5,
      updated_at = now()
  WHERE id = v_board_id;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Successfully created test user profile and 5 posts!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'User: Test Artist (%))', v_author_id;
  RAISE NOTICE 'Board: Concept Art Gallery (%))', v_board_id;
  RAISE NOTICE '';
  RAISE NOTICE 'Posts created:';
  RAISE NOTICE '  1. % - Neon Rain (image)', v_post_id_1;
  RAISE NOTICE '  2. % - Elemental Blade (image)', v_post_id_2;
  RAISE NOTICE '  3. % - Creature Design Tips (text)', v_post_id_3;
  RAISE NOTICE '  4. % - FengZhu Tutorial (link)', v_post_id_4;
  RAISE NOTICE '  5. % - Color Palette Poll (poll)', v_post_id_5;
  RAISE NOTICE '========================================';

END $$;

-- ============================================================================
-- Verification Queries (Optional)
-- ============================================================================

-- Check profile was created:
-- SELECT * FROM public.profiles WHERE user_id = 'e2903097-41a3-442e-a6fe-82f6cec4a532';

-- Check posts were created:
-- SELECT 
--   id,
--   title,
--   post_type,
--   created_at
-- FROM public.posts
-- WHERE board_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
-- ORDER BY created_at DESC;

-- Check poll options:
-- SELECT po.*, p.title 
-- FROM public.poll_options po
-- JOIN public.posts p ON po.post_id = p.id
-- WHERE p.board_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
