-- ============================================================================
-- Karma System Test Script
-- Run this after executing the karma migration to verify everything works
-- ============================================================================

-- ============================================================================
-- Test 1: Check if personas.karma column exists
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'personas' AND column_name = 'karma'
  ) THEN
    RAISE NOTICE 'Test 1 PASSED: personas.karma column exists';
  ELSE
    RAISE EXCEPTION 'Test 1 FAILED: personas.karma column does not exist';
  END IF;
END $$;

-- ============================================================================
-- Test 2: Check if karma_refresh_queue table exists
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'karma_refresh_queue'
  ) THEN
    RAISE NOTICE 'Test 2 PASSED: karma_refresh_queue table exists';
  ELSE
    RAISE EXCEPTION 'Test 2 FAILED: karma_refresh_queue table does not exist';
  END IF;
END $$;

-- ============================================================================
-- Test 3: Check if user_karma_stats materialized view exists
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_matviews 
    WHERE matviewname = 'user_karma_stats'
  ) THEN
    RAISE NOTICE 'Test 3 PASSED: user_karma_stats materialized view exists';
  ELSE
    RAISE EXCEPTION 'Test 3 FAILED: user_karma_stats materialized view does not exist';
  END IF;
END $$;

-- ============================================================================
-- Test 4: Check if functions exist
-- ============================================================================
DO $$
BEGIN
  -- Check refresh_karma function
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'refresh_karma'
  ) THEN
    RAISE NOTICE 'Test 4a PASSED: refresh_karma function exists';
  ELSE
    RAISE EXCEPTION 'Test 4a FAILED: refresh_karma function does not exist';
  END IF;
  
  -- Check refresh_all_karma function
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'refresh_all_karma'
  ) THEN
    RAISE NOTICE 'Test 4b PASSED: refresh_all_karma function exists';
  ELSE
    RAISE EXCEPTION 'Test 4b FAILED: refresh_all_karma function does not exist';
  END IF;
  
  -- Check process_karma_refresh_queue function
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'process_karma_refresh_queue'
  ) THEN
    RAISE NOTICE 'Test 4c PASSED: process_karma_refresh_queue function exists';
  ELSE
    RAISE EXCEPTION 'Test 4c FAILED: process_karma_refresh_queue function does not exist';
  END IF;
END $$;

-- ============================================================================
-- Test 5: Check materialized view data
-- ============================================================================
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.user_karma_stats;
  RAISE NOTICE 'Test 5: user_karma_stats contains % records', v_count;
END $$;

-- ============================================================================
-- Test 6: Sample karma data
-- ============================================================================
SELECT 
  'Profiles' as type,
  username,
  karma,
  (SELECT COUNT(*) FROM posts WHERE author_id = p.user_id) as post_count,
  (SELECT COUNT(*) FROM comments WHERE author_id = p.user_id) as comment_count
FROM public.profiles p
WHERE karma > 0
ORDER BY karma DESC
LIMIT 5;

SELECT 
  'Personas' as type,
  username,
  karma,
  (SELECT COUNT(*) FROM posts WHERE persona_id = p.id) as post_count,
  (SELECT COUNT(*) FROM comments WHERE persona_id = p.id) as comment_count
FROM public.personas p
WHERE karma > 0
ORDER BY karma DESC
LIMIT 5;

-- ============================================================================
-- Test 7: Manual karma calculation vs stored karma
-- ============================================================================
-- Compare calculated karma with stored karma for verification
SELECT 
  p.username,
  p.karma as stored_karma,
  COALESCE(
    (SELECT SUM(score) FROM posts WHERE author_id = p.user_id AND status IN ('PUBLISHED', 'DELETED')), 
    0
  ) + COALESCE(
    (SELECT SUM(score) FROM comments WHERE author_id = p.user_id AND is_deleted = false), 
    0
  ) as calculated_karma,
  p.karma - (
    COALESCE(
      (SELECT SUM(score) FROM posts WHERE author_id = p.user_id AND status IN ('PUBLISHED', 'DELETED')), 
      0
    ) + COALESCE(
      (SELECT SUM(score) FROM comments WHERE author_id = p.user_id AND is_deleted = false), 
      0
    )
  ) as difference
FROM public.profiles p
WHERE p.karma > 0
LIMIT 10;

-- ============================================================================
-- Test 8: Test refresh_karma function for a specific user
-- ============================================================================
DO $$
DECLARE
  v_user_id uuid;
  v_karma_before int;
  v_karma_after int;
BEGIN
  -- Get first user with karma
  SELECT user_id, karma INTO v_user_id, v_karma_before 
  FROM public.profiles 
  WHERE karma > 0 
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Test 8 SKIPPED: No users with karma found';
    RETURN;
  END IF;
  
  -- Refresh karma
  PERFORM public.refresh_karma(v_user_id, NULL);
  
  -- Get karma after refresh
  SELECT karma INTO v_karma_after 
  FROM public.profiles 
  WHERE user_id = v_user_id;
  
  RAISE NOTICE 'Test 8: User karma before=%, after=%, changed=%', 
    v_karma_before, v_karma_after, (v_karma_after != v_karma_before);
END $$;

-- ============================================================================
-- Test 9: Test queue mechanism
-- ============================================================================
DO $$
DECLARE
  v_user_id uuid;
  v_queue_count_before int;
  v_queue_count_after int;
BEGIN
  -- Get first user
  SELECT user_id INTO v_user_id 
  FROM public.profiles 
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Test 9 SKIPPED: No users found';
    RETURN;
  END IF;
  
  -- Check queue size before
  SELECT COUNT(*) INTO v_queue_count_before FROM public.karma_refresh_queue;
  
  -- Insert into queue
  INSERT INTO public.karma_refresh_queue (user_id, persona_id)
  VALUES (v_user_id, NULL)
  ON CONFLICT DO NOTHING;
  
  -- Check queue size after
  SELECT COUNT(*) INTO v_queue_count_after FROM public.karma_refresh_queue;
  
  RAISE NOTICE 'Test 9: Queue size before=%, after=%, added=%', 
    v_queue_count_before, v_queue_count_after, (v_queue_count_after > v_queue_count_before);
  
  -- Process queue
  PERFORM public.process_karma_refresh_queue();
  
  -- Check queue size after processing
  SELECT COUNT(*) INTO v_queue_count_after FROM public.karma_refresh_queue;
  
  RAISE NOTICE 'Test 9: Queue processed, size after=%', v_queue_count_after;
END $$;

-- ============================================================================
-- Test 10: Test triggers
-- ============================================================================
DO $$
DECLARE
  v_user_id uuid;
  v_karma_before int;
  v_post_id uuid;
  v_queue_count int;
BEGIN
  -- Get first user with at least one post
  SELECT p.user_id, prof.karma INTO v_user_id, v_karma_before
  FROM public.posts p
  JOIN public.profiles prof ON prof.user_id = p.author_id
  WHERE p.author_id IS NOT NULL
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Test 10 SKIPPED: No users with posts found';
    RETURN;
  END IF;
  
  -- Get one of their posts
  SELECT id INTO v_post_id
  FROM public.posts
  WHERE author_id = v_user_id
  LIMIT 1;
  
  -- Clear queue first
  DELETE FROM public.karma_refresh_queue WHERE user_id = v_user_id;
  
  -- Update post score (should trigger queue addition)
  UPDATE public.posts 
  SET score = score + 1 
  WHERE id = v_post_id;
  
  -- Check if user was added to queue
  SELECT COUNT(*) INTO v_queue_count
  FROM public.karma_refresh_queue
  WHERE user_id = v_user_id;
  
  IF v_queue_count > 0 THEN
    RAISE NOTICE 'Test 10 PASSED: Trigger added user to queue after score change';
  ELSE
    RAISE NOTICE 'Test 10 FAILED: Trigger did not add user to queue';
  END IF;
  
  -- Revert the score change
  UPDATE public.posts 
  SET score = score - 1 
  WHERE id = v_post_id;
END $$;

-- ============================================================================
-- Summary
-- ============================================================================
SELECT 'Karma System Test Complete!' as message;
SELECT 
  (SELECT COUNT(*) FROM public.profiles WHERE karma > 0) as users_with_karma,
  (SELECT COUNT(*) FROM public.personas WHERE karma > 0) as personas_with_karma,
  (SELECT COUNT(*) FROM public.karma_refresh_queue) as queue_size,
  (SELECT COUNT(*) FROM public.user_karma_stats) as materialized_view_records;
