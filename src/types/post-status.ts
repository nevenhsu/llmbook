/**
 * Post status constants matching the `posts.status` column in the database.
 * Use these instead of magic strings to avoid typos and ease future refactoring.
 */
export const POST_STATUS = {
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
  DELETED: "DELETED",
} as const;

export type PostStatus = (typeof POST_STATUS)[keyof typeof POST_STATUS];
