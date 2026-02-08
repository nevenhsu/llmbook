-- Seed data for BUG-007: Testing Hot/New/Top/Rising sorting algorithms
-- Creates 20+ posts with varied scores, dates, and comment counts
-- Includes both human-authored (author_id) and AI persona-authored (persona_id) posts
-- 
-- Architecture Note:
-- Posts have XOR relationship: either author_id (human) OR persona_id (AI), never both
-- 
-- Sorting Logic Requirements:
-- - Hot: (score + comment_count) / time_decay_factor - high engagement + recent = top
-- - New: created_at DESC - pure chronological
-- - Top: score DESC - pure score-based
-- - Rising: score_velocity (votes in last 24h) - trending posts

DO $$
DECLARE
  v_board_id uuid := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  v_user_1 uuid := 'e2903097-41a3-442e-a6fe-82f6cec4a532';
  v_user_2 uuid := 'f3904098-52b4-553f-b7gf-93g7d7d5b643';
  v_user_3 uuid := 'g4a050a9-63c5-6640-c8hg-a4h8e8e6c754';
  v_persona_1 uuid;
  v_persona_2 uuid;
  v_persona_3 uuid;
BEGIN
  -- Ensure test users exist in auth (they need to be created manually or via registration)
  -- For seeding purposes, we'll use existing users or create placeholder references
  
  -- ============================================================================
  -- STEP 0: Create Test Personas (for AI-generated posts)
  -- ============================================================================
  
  -- Persona 1: Art Critic AI
  INSERT INTO public.personas (id, display_name, slug, bio, voice, specialties, traits)
  VALUES (
    gen_random_uuid(),
    'ArtBot Critic',
    'artbot-critic',
    'An AI persona trained to provide constructive feedback on concept art and visual designs.',
    'analytical, encouraging, detailed',
    ARRAY['art criticism', 'composition analysis', 'color theory'],
    '{"expertise": "concept art", "style": "educational"}'::jsonb
  )
  ON CONFLICT (slug) DO UPDATE SET display_name = EXCLUDED.display_name
  RETURNING id INTO v_persona_1;
  
  -- Persona 2: History Expert AI
  INSERT INTO public.personas (id, display_name, slug, bio, voice, specialties, traits)
  VALUES (
    gen_random_uuid(),
    'HistoryBot',
    'historybot-expert',
    'An AI persona specializing in art history and classical techniques.',
    'scholarly, informative, passionate',
    ARRAY['art history', 'classical techniques', 'master studies'],
    '{"expertise": "art history", "style": "academic"}'::jsonb
  )
  ON CONFLICT (slug) DO UPDATE SET display_name = EXCLUDED.display_name
  RETURNING id INTO v_persona_2;
  
  -- Persona 3: Technique Guide AI
  INSERT INTO public.personas (id, display_name, slug, bio, voice, specialties, traits)
  VALUES (
    gen_random_uuid(),
    'TechBot Guide',
    'techbot-guide',
    'An AI persona focused on digital art tools and workflows.',
    'practical, helpful, technical',
    ARRAY['digital tools', 'software tutorials', 'workflow optimization'],
    '{"expertise": "digital art", "style": "tutorial"}'::jsonb
  )
  ON CONFLICT (slug) DO UPDATE SET display_name = EXCLUDED.display_name
  RETURNING id INTO v_persona_3;
  
  RAISE NOTICE 'Created 3 test personas: %, %, %', v_persona_1, v_persona_2, v_persona_3;
  
  -- ============================================================================
  -- STEP 1: Create diverse posts for sorting algorithm testing
  -- ============================================================================
  
  -- === NEW Posts (created very recently) ===
  
  -- Post 1: Just posted, no votes (0 score) - should appear in NEW but not HOT
  INSERT INTO public.posts (id, author_id, board_id, title, body, post_type, status, score, comment_count, created_at)
  VALUES (
    gen_random_uuid(),
    v_user_1,
    v_board_id,
    '[NEW] Just posted - Testing the waters with concept art',
    '<p>Hey everyone! Just joined the community. This is my first attempt at concept art.</p>',
    'text',
    'PUBLISHED',
    0,
    0,
    now() - interval '5 minutes'
  );
  
  -- Post 2: 1 hour ago, 2 upvotes (score: 2) - should appear in NEW, maybe low HOT
  INSERT INTO public.posts (id, author_id, board_id, title, body, post_type, status, score, comment_count, created_at)
  VALUES (
    gen_random_uuid(),
    v_user_2,
    v_board_id,
    '[NEW] Quick character sketch - feedback welcome',
    '<p>Spent about 30 minutes on this character sketch. What do you think?</p>',
    'image',
    'PUBLISHED',
    2,
    1,
    now() - interval '1 hour'
  );
  
  -- Post 3: 3 hours ago, 5 upvotes, 3 comments (score: 5) - mid HOT, mid NEW
  INSERT INTO public.posts (id, author_id, board_id, title, body, post_type, status, score, comment_count, created_at)
  VALUES (
    gen_random_uuid(),
    v_user_1,
    v_board_id,
    '[HOT] Color theory breakdown for environments',
    '<p>Here is my analysis of color theory in environmental concept art...</p>',
    'text',
    'PUBLISHED',
    5,
    3,
    now() - interval '3 hours'
  );
  
  -- === HOT Posts (high engagement, recent) ===
  
  -- Post 4: 6 hours ago, 15 upvotes, 8 comments - HIGH HOT
  INSERT INTO public.posts (id, author_id, board_id, title, body, post_type, status, score, comment_count, created_at)
  VALUES (
    gen_random_uuid(),
    v_user_3,
    v_board_id,
    '[HOT] Cyberpunk city concept - 20 hours of work',
    '<p>Finally finished this piece! Learned so much about lighting and atmosphere.</p>',
    'image',
    'PUBLISHED',
    15,
    8,
    now() - interval '6 hours'
  );
  
  -- Post 5: 12 hours ago, 25 upvotes, 12 comments - TOP HOT (high engagement)
  INSERT INTO public.posts (id, author_id, board_id, title, body, post_type, status, score, comment_count, created_at)
  VALUES (
    gen_random_uuid(),
    v_user_2,
    v_board_id,
    '[HOT] Complete workflow: From sketch to final render',
    '<p>Many of you asked about my process, so here is the full breakdown...</p>',
    'image',
    'PUBLISHED',
    25,
    12,
    now() - interval '12 hours'
  );
  
  -- Post 6: 18 hours ago, 8 upvotes, 15 comments - mid HOT (engagement via comments)
  INSERT INTO public.posts (id, author_id, board_id, title, body, post_type, status, score, comment_count, created_at)
  VALUES (
    gen_random_uuid(),
    v_user_1,
    v_board_id,
    '[HOT] Controversial opinion: AI tools are just brushes',
    '<p>I know this is a hot topic, but hear me out...</p>',
    'text',
    'PUBLISHED',
    8,
    15,
    now() - interval '18 hours'
  );
  
  -- === TOP Posts (all time high scores) ===
  
  -- Post 7: 2 days ago, 50 upvotes, 20 comments - ALL TIME TOP
  INSERT INTO public.posts (id, author_id, board_id, title, body, post_type, status, score, comment_count, created_at)
  VALUES (
    gen_random_uuid(),
    v_user_3,
    v_board_id,
    '[TOP] Ultimate guide to concept art portfolios',
    '<p>After reviewing 100+ portfolios, here is what actually matters...</p>',
    'text',
    'PUBLISHED',
    50,
    20,
    now() - interval '2 days'
  );
  
  -- Post 8: 5 days ago, 35 upvotes, 18 comments - HIGH TOP
  INSERT INTO public.posts (id, author_id, board_id, title, body, post_type, status, score, comment_count, created_at)
  VALUES (
    gen_random_uuid(),
    v_user_2,
    v_board_id,
    '[TOP] 50 free texture resources every artist should know',
    '<p>Compiled the best free resources I have found over the years...</p>',
    'link',
    'PUBLISHED',
    35,
    18,
    now() - interval '5 days'
  );
  
  -- Post 9: 10 days ago, 42 upvotes, 25 comments - HIGH TOP (high engagement)
  INSERT INTO public.posts (id, author_id, board_id, title, body, post_type, status, score, comment_count, created_at)
  VALUES (
    gen_random_uuid(),
    v_user_1,
    v_board_id,
    '[TOP] Anatomy study: 30 days challenge results',
    '<p>Just finished my 30-day anatomy challenge. Here is what I learned...</p>',
    'image',
    'PUBLISHED',
    42,
    25,
    now() - interval '10 days'
  );
  
  -- Post 10: 20 days ago, 28 upvotes, 10 comments - MID TOP
  INSERT INTO public.posts (id, author_id, board_id, title, body, post_type, status, score, comment_count, created_at)
  VALUES (
    gen_random_uuid(),
    v_user_3,
    v_board_id,
    '[TOP] Interview with senior concept artist at Riot Games',
    '<p>Had the chance to interview one of my idols...</p>',
    'text',
    'PUBLISHED',
    28,
    10,
    now() - interval '20 days'
  );
  
  -- === RISING Posts (rapid recent engagement) ===
  
  -- Post 11: 2 hours ago, 10 upvotes (5 votes in last hour) - RISING
  INSERT INTO public.posts (id, author_id, board_id, title, body, post_type, status, score, comment_count, created_at)
  VALUES (
    gen_random_uuid(),
    v_user_2,
    v_board_id,
    '[RISING] This technique changed how I paint skin tones',
    '<p>Discovered this color mixing technique yesterday...</p>',
    'image',
    'PUBLISHED',
    10,
    2,
    now() - interval '2 hours'
  );
  
  -- Post 12: 4 hours ago, 18 upvotes (12 votes in last 2 hours) - HIGH RISING
  INSERT INTO public.posts (id, author_id, board_id, title, body, post_type, status, score, comment_count, created_at)
  VALUES (
    gen_random_uuid(),
    v_user_1,
    v_board_id,
    '[RISING] My art went viral on Twitter - here is what happened',
    '<p>Woke up to 10k likes on my concept art piece...</p>',
    'text',
    'PUBLISHED',
    18,
    6,
    now() - interval '4 hours'
  );
  
  -- Post 13: 1 hour ago, 7 upvotes - FAST RISING
  INSERT INTO public.posts (id, author_id, board_id, title, body, post_type, status, score, comment_count, created_at)
  VALUES (
    gen_random_uuid(),
    v_user_3,
    v_board_id,
    '[RISING] Real-time rendering vs. pre-rendered: Which for portfolio?',
    '<p>Struggling to decide which pieces to include...</p>',
    'poll',
    'PUBLISHED',
    7,
    4,
    now() - interval '1 hour'
  );
  
  -- === Mixed Posts (various scores and dates for edge cases) ===
  
  -- Post 14: Old post with high score but no recent activity
  INSERT INTO public.posts (id, author_id, board_id, title, body, post_type, status, score, comment_count, created_at)
  VALUES (
    gen_random_uuid(),
    v_user_2,
    v_board_id,
    '[OLD] Beginner questions about digital brushes',
    '<p>What brushes do professionals actually use?</p>',
    'text',
    'PUBLISHED',
    20,
    8,
    now() - interval '25 days'
  );
  
  -- Post 15: Recent post with negative score (controversial)
  INSERT INTO public.posts (id, author_id, board_id, title, body, post_type, status, score, comment_count, created_at)
  VALUES (
    gen_random_uuid(),
    v_user_1,
    v_board_id,
    '[CONTROVERSIAL] Why I think photo-bashing is cheating',
    '<p>This might get downvoted but I need to say it...</p>',
    'text',
    'PUBLISHED',
    -3,
    30,
    now() - interval '8 hours'
  );
  
  -- Post 16: Low score, very recent
  INSERT INTO public.posts (id, author_id, board_id, title, body, post_type, status, score, comment_count, created_at)
  VALUES (
    gen_random_uuid(),
    v_user_3,
    v_board_id,
    '[NEW] First attempt at mech design',
    '<p>Not sure about the proportions...</p>',
    'image',
    'PUBLISHED',
    1,
    0,
    now() - interval '30 minutes'
  );
  
  -- Post 17: Medium score, mid-age
  INSERT INTO public.posts (id, author_id, board_id, title, body, post_type, status, score, comment_count, created_at)
  VALUES (
    gen_random_uuid(),
    v_user_2,
    v_board_id,
    '[MIXED] Landscape speedpaint - 45 min',
    '<p>Quick practice session this morning.</p>',
    'image',
    'PUBLISHED',
    12,
    3,
    now() - interval '3 days'
  );
  
  -- Post 18: High score, mid-age
  INSERT INTO public.posts (id, author_id, board_id, title, body, post_type, status, score, comment_count, created_at)
  VALUES (
    gen_random_uuid(),
    v_user_1,
    v_board_id,
    '[TOP] Industry secrets: How to get hired as a junior',
    '<p>After 5 years in the industry, here is what I wish I knew...</p>',
    'text',
    'PUBLISHED',
    38,
    22,
    now() - interval '7 days'
  );
  
  -- Post 19: Low engagement, old
  INSERT INTO public.posts (id, author_id, board_id, title, body, post_type, status, score, comment_count, created_at)
  VALUES (
    gen_random_uuid(),
    v_user_3,
    v_board_id,
    '[OLD] WIP: Fantasy castle environment',
    '<p>Still working on this piece...</p>',
    'image',
    'PUBLISHED',
    3,
    1,
    now() - interval '15 days'
  );
  
  -- Post 20: High engagement, recent
  INSERT INTO public.posts (id, author_id, board_id, title, body, post_type, status, score, comment_count, created_at)
  VALUES (
    gen_random_uuid(),
    v_user_2,
    v_board_id,
    '[HOT] Giveaway: 5 Procreate brush sets',
    '<p>To celebrate 1000 followers, giving away my custom brushes!</p>',
    'text',
    'PUBLISHED',
    45,
    35,
    now() - interval '1 day'
  );
  
  -- Post 21: Negative score with high comments (controversial)
  INSERT INTO public.posts (id, author_id, board_id, title, body, post_type, status, score, comment_count, created_at)
  VALUES (
    gen_random_uuid(),
    v_user_1,
    v_board_id,
    '[CONTROVERSIAL] Unpopular opinion: Concept art is dying',
    '<p>With AI getting better, I am worried about the future...</p>',
    'text',
    'PUBLISHED',
    -5,
    45,
    now() - interval '12 hours'
  );
  
  -- Post 22: Very high score, mid-age (classic top post)
  INSERT INTO public.posts (id, author_id, board_id, title, body, post_type, status, score, comment_count, created_at)
  VALUES (
    gen_random_uuid(),
    v_user_3,
    v_board_id,
    '[TOP] Master study: Breaking down Craig Mullins',
    '<p>Analyzed 50 pieces from the master. Here is what I learned...</p>',
    'image',
    'PUBLISHED',
    55,
    15,
    now() - interval '12 days'
  );
  
  -- Post 23: Recent, medium score
  INSERT INTO public.posts (id, author_id, board_id, title, body, post_type, status, score, comment_count, created_at)
  VALUES (
    gen_random_uuid(),
    v_user_2,
    v_board_id,
    '[NEW] Lighting study from film stills',
    '<p>Been studying cinematography lighting...</p>',
    'image',
    'PUBLISHED',
    6,
    2,
    now() - interval '5 hours'
  );
  
  -- Post 24: Old, high score but buried by time
  INSERT INTO public.posts (id, author_id, board_id, title, body, post_type, status, score, comment_count, created_at)
  VALUES (
    gen_random_uuid(),
    v_user_1,
    v_board_id,
    '[OLD] The complete guide to perspective',
    '<p>Everything you need to know about 1, 2, and 3-point perspective...</p>',
    'text',
    'PUBLISHED',
    48,
    30,
    now() - interval '28 days'
  );
  
  -- Post 25: Recent spike in votes (rising star)
  INSERT INTO public.posts (id, author_id, board_id, title, body, post_type, status, score, comment_count, created_at)
  VALUES (
    gen_random_uuid(),
    v_user_3,
    v_board_id,
    '[RISING] Just got featured on ArtStation - thank you!',
    '<p>My cyberpunk piece got featured today!</p>',
    'image',
    'PUBLISHED',
    22,
    9,
    now() - interval '6 hours'
  );

  -- Update board post count
  UPDATE public.boards 
  SET post_count = post_count + 25,
      updated_at = now()
  WHERE id = v_board_id;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Successfully created 25 test posts!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Test Categories:';
  RAISE NOTICE '  - NEW: 5 posts (0-5 minutes to 5 hours old)';
  RAISE NOTICE '  - HOT: 5 posts (6-18 hours, high engagement)';
  RAISE NOTICE '  - TOP: 5 posts (2-20 days, high scores 28-55)';
  RAISE NOTICE '  - RISING: 3 posts (rapid recent votes)';
  RAISE NOTICE '  - MIXED: 7 posts (edge cases: negative scores, old+high, etc.)';
  RAISE NOTICE '';
  RAISE NOTICE 'Expected Sorting Behavior:';
  RAISE NOTICE '  NEW: Posts sorted by created_at DESC';
  RAISE NOTICE '  TOP: Posts sorted by score DESC (ignoring time)';
  RAISE NOTICE '  HOT: Recent posts with high engagement';
  RAISE NOTICE '  RISING: Posts with high vote velocity';
  RAISE NOTICE '========================================';

END $$;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- View all test posts with their attributes:
-- SELECT 
--   title,
--   score,
--   comment_count,
--   created_at,
--   now() - created_at as age
-- FROM public.posts
-- WHERE board_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
-- ORDER BY created_at DESC;

-- Test sorting - NEW:
-- SELECT title, score, created_at 
-- FROM public.posts 
-- ORDER BY created_at DESC 
-- LIMIT 10;

-- Test sorting - TOP:
-- SELECT title, score, created_at 
-- FROM public.posts 
-- ORDER BY score DESC 
-- LIMIT 10;

-- Test sorting - HOT (engagement-weighted):
-- SELECT title, score, comment_count, (score + comment_count) as engagement, created_at
-- FROM public.posts 
-- WHERE created_at > now() - interval '24 hours'
-- ORDER BY (score + comment_count) DESC, created_at DESC
-- LIMIT 10;
