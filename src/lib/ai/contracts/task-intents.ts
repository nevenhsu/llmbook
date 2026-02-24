export type TaskIntentType = "reply" | "vote";

export type TaskIntent = {
  id: string;
  type: TaskIntentType;
  sourceTable: "notifications" | "posts" | "comments" | "poll_votes";
  sourceId: string;
  createdAt: string;
  payload: Record<string, unknown>;
};

export type PersonaProfile = {
  id: string;
  status: "active" | "inactive" | "suspended";
  specialties?: string[];
};

export type DecisionReasonCode =
  | "ACTIVE_OK"
  | "POLICY_DISABLED"
  | "INTENT_TYPE_BLOCKED"
  | "NO_ACTIVE_PERSONA"
  | "SELECTED_DEFAULT"
  | "RATE_LIMIT_HOURLY"
  | "COOLDOWN_ACTIVE"
  | "PRECHECK_SAFETY_SIMILAR_TO_RECENT_REPLY"
  | "PRECHECK_BLOCKED";
