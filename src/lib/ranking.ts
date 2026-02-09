/**
 * Hot ranking algorithm - 權重: Comments > Score > Time
 *
 * 公式: hot_score = (comment_count * 2) + (score * 1) - min(age_days, 30)
 *
 * 說明:
 * - Comments 權重最高 (乘以 2) - 互動數是最重要的因素
 * - Score 次要權重 (乘以 1) - 投票分數有加成但較低
 * - Time 是衰減因子 (每天扣 1 分，最多扣 30 分)
 * - 同分時按時間新的優先
 * - 只考慮最近 30 天內的貼文
 */
export function hotScore(score: number, commentCount: number, createdAtIso: string): number {
  const now = Date.now();
  const createdAt = new Date(createdAtIso).getTime();
  const ageDays = (now - createdAt) / (1000 * 60 * 60 * 24);

  // 只考慮最近 30 天內的貼文
  if (ageDays > 30) return -Infinity;

  // 基礎分數 = (評論數 * 2) + (投票分 * 1)
  const engagementScore = (commentCount * 2) + score;

  // 時間衰減: 每天扣 1 分，最多扣 30 分
  const timeDecay = Math.min(ageDays, 30);

  return engagementScore - timeDecay;
}

/**
 * Rising score: Recent posts with velocity
 * velocity = score / hours_since_creation
 * Only for posts < 72 hours (3 days) old
 */
export function risingScore(score: number, createdAtIso: string): number {
  const now = Date.now();
  const createdAt = new Date(createdAtIso).getTime();
  const ageMs = now - createdAt;
  const ageHours = ageMs / (1000 * 60 * 60);
  
  // Only consider posts less than 72 hours (3 days) old
  if (ageHours > 72) return -Infinity;
  
  // Avoid division by zero, use minimum 0.1 hours
  const hours = Math.max(ageHours, 0.1);
  return score / hours;
}

/**
 * Best score: Weighted by upvote ratio and total score
 * Combines confidence with popularity
 */
export function bestScore(score: number, upvotes: number, downvotes: number): number {
  const total = upvotes + downvotes;
  if (total === 0) return 0;
  
  // Wilson score confidence interval
  const p = upvotes / total;
  const z = 1.96; // 95% confidence
  const n = total;
  
  const left = p + (z * z) / (2 * n);
  const right = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
  const under = 1 + (z * z) / n;
  
  return (left - right) / under;
}

/**
 * Time range filter helper
 * Returns ISO date string for filtering by time period
 */
export function getTimeRangeDate(range: string): string | null {
  const now = Date.now();
  const ranges: Record<string, number> = {
    hour: 3600000,        // 1 hour in ms
    today: 86400000,      // 24 hours
    day: 86400000,
    week: 604800000,      // 7 days
    month: 2592000000,    // 30 days
    year: 31536000000,    // 365 days
    all: 0                // No filter
  };
  const ms = ranges[range];
  if (ms === undefined) return null;
  if (ms === 0) return null; // 'all' time
  return new Date(now - ms).toISOString();
}

/**
 * Sort posts by the specified algorithm
 */
export type SortType = 'hot' | 'new' | 'top' | 'rising' | 'best';

export interface Post {
  score: number;
  created_at: string;
  comment_count?: number;
  upvotes?: number;
  downvotes?: number;
}

export function sortPosts<T extends Post>(posts: T[], sort: SortType): T[] {
  switch (sort) {
    case 'hot':
      return [...posts].sort((a, b) => 
        hotScore(b.score, b.comment_count || 0, b.created_at) - hotScore(a.score, a.comment_count || 0, a.created_at)
      );
    
    case 'rising':
      return [...posts]
        .filter(p => {
          const ageHours = (Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60);
          return ageHours <= 168; // 7天內
        })
        .sort((a, b) => 
          risingScore(b.score, b.created_at) - risingScore(a.score, a.created_at)
        );
    
    case 'best':
      return [...posts].sort((a, b) => {
        const scoreA = bestScore(
          a.score,
          a.upvotes || Math.max(0, a.score),
          a.downvotes || 0
        );
        const scoreB = bestScore(
          b.score,
          b.upvotes || Math.max(0, b.score),
          b.downvotes || 0
        );
        return scoreB - scoreA;
      });
    
    case 'top':
      return [...posts].sort((a, b) => b.score - a.score);
    
    case 'new':
    default:
      return [...posts].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
  }
}

// ============================================================================
// Ranking Cache Functions
// ============================================================================

/**
 * Update post rankings cache via Supabase RPC
 * This should be called by a cron job every 5-15 minutes
 * 
 * @param supabase - Supabase client (with service role for admin operations)
 * @returns Promise<boolean> - true if update was successful
 */
export async function updatePostRankings(supabase: any): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('fn_update_post_rankings');
    
    if (error) {
      console.error('Failed to update post rankings:', error);
      return false;
    }
    
    console.log('Post rankings updated successfully at', new Date().toISOString());
    return true;
  } catch (err) {
    console.error('Error updating post rankings:', err);
    return false;
  }
}

/**
 * Get posts sorted by hot rank from cache table
 * 
 * @param supabase - Supabase client
 * @param options - Query options
 * @returns Posts with hot ranking
 */
export async function getHotPostsFromCache(
  supabase: any,
  options: {
    boardId?: string;
    limit?: number;
    cursor?: number;
  } = {}
) {
  const { boardId, limit = 20, cursor = 0 } = options;
  
  let query = supabase
    .from('post_rankings')
    .select(`
      hot_rank,
      hot_score,
      calculated_at,
      posts!inner(
        id, title, created_at, score, comment_count, board_id, author_id, persona_id,
        boards!inner(name, slug),
        profiles(display_name, avatar_url),
        personas(display_name, avatar_url),
        media(url),
        post_tags(tag:tags(name))
      )
    `)
    .gt('hot_rank', 0)
    .order('hot_rank', { ascending: true })
    .range(cursor, cursor + limit - 1);
  
  if (boardId) {
    query = query.eq('board_id', boardId);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching hot posts from cache:', error);
    return { posts: [], error };
  }
  
  // Flatten the nested structure
  const posts = data?.map((item: any) => ({
    ...item.posts,
    _rank: item.hot_rank,
    _score: item.hot_score,
    _calculated_at: item.calculated_at,
  })) || [];
  
  return { posts, error: null };
}

/**
 * Get posts sorted by rising rank from cache table
 * 
 * @param supabase - Supabase client
 * @param options - Query options
 * @returns Posts with rising ranking
 */
export async function getRisingPostsFromCache(
  supabase: any,
  options: {
    boardId?: string;
    limit?: number;
    cursor?: number;
  } = {}
) {
  const { boardId, limit = 20, cursor = 0 } = options;
  
  let query = supabase
    .from('post_rankings')
    .select(`
      rising_rank,
      rising_score,
      calculated_at,
      posts!inner(
        id, title, created_at, score, comment_count, board_id, author_id, persona_id,
        boards!inner(name, slug),
        profiles(display_name, avatar_url),
        personas(display_name, avatar_url),
        media(url),
        post_tags(tag:tags(name))
      )
    `)
    .gt('rising_rank', 0)
    .order('rising_rank', { ascending: true })
    .range(cursor, cursor + limit - 1);
  
  if (boardId) {
    query = query.eq('board_id', boardId);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching rising posts from cache:', error);
    return { posts: [], error };
  }
  
  // Flatten the nested structure
  const posts = data?.map((item: any) => ({
    ...item.posts,
    _rank: item.rising_rank,
    _score: item.rising_score,
    _calculated_at: item.calculated_at,
  })) || [];
  
  return { posts, error: null };
}

/**
 * Check if rankings cache is stale (older than threshold)
 * 
 * @param supabase - Supabase client
 * @param maxAgeMinutes - Maximum age before considered stale (default: 15)
 * @returns Promise<boolean> - true if cache is stale or empty
 */
export async function isRankingCacheStale(
  supabase: any,
  maxAgeMinutes: number = 15
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('post_rankings')
      .select('calculated_at')
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error || !data) {
      return true; // No cache or error = stale
    }
    
    const lastUpdate = new Date(data.calculated_at).getTime();
    const now = Date.now();
    const ageMinutes = (now - lastUpdate) / (1000 * 60);
    
    return ageMinutes > maxAgeMinutes;
  } catch {
    return true;
  }
}
