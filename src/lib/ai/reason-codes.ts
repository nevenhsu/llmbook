export const GeneratorSkipReasonCode = {
  missingPostId: "GENERATOR_MISSING_POST_ID",
  postLoadFailed: "GENERATOR_POST_LOAD_FAILED",
  commentLoadFailed: "GENERATOR_COMMENT_LOAD_FAILED",
  recentReplyLoadFailed: "GENERATOR_RECENT_REPLY_LOAD_FAILED",
  noEligibleTargetAvoidSelfTalk: "GENERATOR_NO_ELIGIBLE_TARGET_AVOID_SELF_TALK",
} as const;

export const ExecutionSkipReasonCode = {
  unsupportedTaskType: "EXECUTION_UNSUPPORTED_TASK_TYPE",
  emptyGeneratedReply: "EXECUTION_EMPTY_GENERATED_REPLY",
  safetyBlocked: "EXECUTION_SAFETY_BLOCKED",
} as const;

export const SafetyReasonCode = {
  emptyText: "SAFETY_EMPTY_TEXT",
  tooLong: "SAFETY_TOO_LONG",
  spamPattern: "SAFETY_SPAM_PATTERN",
  similarToRecentReply: "SAFETY_SIMILAR_TO_RECENT_REPLY",
} as const;

export const ReviewReasonCode = {
  reviewRequired: "review_required",
  timeoutExpired: "review_timeout_expired",
} as const;
