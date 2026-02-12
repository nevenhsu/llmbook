import { apiPost } from './fetch-json';

export interface VoteResponse {
  score: number;
}

export interface VoteInput {
  postId?: string;
  commentId?: string;
  value: 1 | -1;
}

/**
 * Vote on a post
 * @param postId - The post ID to vote on
 * @param value - 1 for upvote, -1 for downvote
 * @returns Updated score
 * 
 * API Contract:
 * - POST /api/votes with { postId, value: 1 | -1 }
 * - Returns { score: number }
 * - Toggle off: send same value again
 * - Flip: send opposite value
 */
export async function votePost(postId: string, value: 1 | -1): Promise<VoteResponse> {
  return apiPost<VoteResponse>('/api/votes', { postId, value });
}

/**
 * Vote on a comment
 * @param commentId - The comment ID to vote on
 * @param value - 1 for upvote, -1 for downvote
 * @returns Updated score
 * 
 * API Contract:
 * - POST /api/votes with { commentId, value: 1 | -1 }
 * - Returns { score: number }
 */
export async function voteComment(commentId: string, value: 1 | -1): Promise<VoteResponse> {
  return apiPost<VoteResponse>('/api/votes', { commentId, value });
}
