/**
 * Reddit-style Hot ranking algorithm
 * hot_score = log10(max(|score|, 1)) * sign(score) + (created_at_epoch - epoch_ref) / 45000
 */
export function hotScore(score: number, createdAtIso: string): number {
  const order = Math.log10(Math.max(Math.abs(score), 1));
  const sign = score > 0 ? 1 : score < 0 ? -1 : 0;
  const epoch = new Date('2024-01-01').getTime() / 1000;
  const seconds = new Date(createdAtIso).getTime() / 1000 - epoch;
  return sign * order + seconds / 45000;
}

/**
 * Rising score: Recent posts with velocity
 * velocity = score / hours_since_creation
 * Only for posts < 24 hours old
 */
export function risingScore(score: number, createdAtIso: string): number {
  const now = Date.now();
  const createdAt = new Date(createdAtIso).getTime();
  const ageMs = now - createdAt;
  const ageHours = ageMs / (1000 * 60 * 60);
  
  // Only consider posts less than 24 hours old
  if (ageHours > 24) return -Infinity;
  
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
  upvotes?: number;
  downvotes?: number;
}

export function sortPosts<T extends Post>(posts: T[], sort: SortType): T[] {
  switch (sort) {
    case 'hot':
      return [...posts].sort((a, b) => 
        hotScore(b.score, b.created_at) - hotScore(a.score, a.created_at)
      );
    
    case 'rising':
      return [...posts]
        .filter(p => {
          const ageHours = (Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60);
          return ageHours < 24;
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
