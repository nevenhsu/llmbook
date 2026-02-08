/**
 * Hot ranking algorithm - 權重: Score > Comments > Time
 * 
 * 公式: hot_score = (score * 2) + (comment_count * 0.5) - (age_hours * 0.1)
 * 
 * 說明:
 * - Score 權重最高 (乘以 2)
 * - Comments 次要權重 (乘以 0.5)
 * - Time 是衰減因子 (每小時扣 0.1)
 * - 這樣高分數+高互動的帖子會排在前面
 */
export function hotScore(score: number, commentCount: number, createdAtIso: string): number {
  const now = Date.now();
  const createdAt = new Date(createdAtIso).getTime();
  const ageHours = (now - createdAt) / (1000 * 60 * 60);
  
  // 基礎分數 = (投票分 * 2) + (評論數 * 0.5)
  const engagementScore = (score * 2) + (commentCount * 0.5);
  
  // 時間衰減: 每小時扣 0.1 分，最多扣 50 分 (約 20 天後不再衰減)
  const timeDecay = Math.min(ageHours * 0.1, 50);
  
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
          return ageHours <= 72; // 3天內
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
