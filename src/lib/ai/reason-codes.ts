export const GeneratorSkipReasonCode = {
  missingPostId: "GENERATOR_MISSING_POST_ID",
  postLoadFailed: "GENERATOR_POST_LOAD_FAILED",
  commentLoadFailed: "GENERATOR_COMMENT_LOAD_FAILED",
  recentReplyLoadFailed: "GENERATOR_RECENT_REPLY_LOAD_FAILED",
  noEligibleTargetAvoidSelfTalk: "GENERATOR_NO_ELIGIBLE_TARGET_AVOID_SELF_TALK",
} as const;

export const ExecutionSkipReasonCode = {
  unsupportedTaskType: "EXECUTION_UNSUPPORTED_TASK_TYPE",
  policyDisabled: "POLICY_DISABLED",
  emptyGeneratedReply: "EXECUTION_EMPTY_GENERATED_REPLY",
  safetyBlocked: "EXECUTION_SAFETY_BLOCKED",
} as const;

export const ExecutionRuntimeReasonCode = {
  taskClaimed: "EXECUTION_TASK_CLAIMED",
  taskCompleted: "EXECUTION_TASK_COMPLETED",
  taskFailed: "EXECUTION_TASK_FAILED",
  skipped: "EXECUTION_TASK_SKIPPED",
  circuitOpened: "EXECUTION_CIRCUIT_OPENED",
  circuitOpen: "EXECUTION_CIRCUIT_OPEN",
  circuitResumed: "EXECUTION_CIRCUIT_RESUMED",
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

export const PolicyControlPlaneReasonCode = {
  cacheHit: "POLICY_CACHE_HIT",
  cacheRefresh: "POLICY_CACHE_REFRESHED",
  noActiveRelease: "POLICY_NO_ACTIVE_RELEASE",
  loadFailed: "POLICY_LOAD_FAILED",
  fallbackLastKnownGood: "POLICY_FALLBACK_LAST_KNOWN_GOOD",
  fallbackDefault: "POLICY_FALLBACK_DEFAULT",
} as const;

export const MemoryReasonCode = {
  cacheHit: "MEMORY_CACHE_HIT",
  cacheRefresh: "MEMORY_CACHE_REFRESHED",
  loadFailed: "MEMORY_LOAD_FAILED",
  readFailed: "MEMORY_READ_FAILED",
  fallbackLastKnownGood: "MEMORY_FALLBACK_LAST_KNOWN_GOOD",
  fallbackEmpty: "MEMORY_FALLBACK_EMPTY",
  trimApplied: "MEMORY_TRIM_APPLIED",
  threadMissing: "MEMORY_THREAD_MISSING",
  schemaNormalized: "MEMORY_SCHEMA_NORMALIZED",
} as const;

export const SoulReasonCode = {
  loadSuccess: "SOUL_LOAD_SUCCESS",
  loadFailed: "SOUL_LOAD_FAILED",
  fallbackEmpty: "SOUL_FALLBACK_EMPTY",
  applied: "SOUL_APPLIED",
} as const;

export const PromptRuntimeReasonCode = {
  promptBuildSuccess: "PROMPT_BUILD_SUCCESS",
  promptBuildFailed: "PROMPT_BUILD_FAILED",
  modelCallFailed: "MODEL_CALL_FAILED",
  modelFallbackUsed: "MODEL_FALLBACK_USED",
} as const;

export const ToolRuntimeReasonCode = {
  toolCallSucceeded: "TOOL_CALL_SUCCEEDED",
  toolValidationFailed: "TOOL_VALIDATION_FAILED",
  toolHandlerFailed: "TOOL_HANDLER_FAILED",
  toolNotAllowed: "TOOL_NOT_ALLOWED",
  toolNotFound: "TOOL_NOT_FOUND",
  toolLoopMaxIterations: "TOOL_LOOP_MAX_ITERATIONS",
  toolLoopTimeout: "TOOL_LOOP_TIMEOUT",
} as const;

export const ProviderRuntimeReasonCode = {
  providerCallSucceeded: "PROVIDER_CALL_SUCCEEDED",
  providerCallFailed: "PROVIDER_CALL_FAILED",
  providerTimeout: "PROVIDER_TIMEOUT",
  providerRetrying: "PROVIDER_RETRYING",
  providerFallbackUsed: "PROVIDER_FALLBACK_USED",
  providerFailSafeReturned: "PROVIDER_FAIL_SAFE_RETURNED",
  providerUsageNormalized: "PROVIDER_USAGE_NORMALIZED",
} as const;
