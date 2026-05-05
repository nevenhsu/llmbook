import {
  PersonaGenerationParseError,
  PromptAssistError,
  type PersonaGenerationCoreStage,
  type PersonaGenerationSeedStage,
  type PersonaGenerationSemanticAuditResult,
  type PersonaGenerationStructured,
  type PromptAssistAttemptStage,
  type PromptAssistNamedReference,
  type PromptAssistNamedReferenceType,
  type PromptAssistReferenceResolutionOutput,
} from "@/lib/ai/admin/control-plane-contract";
import {
  asRecord,
  buildLlmErrorDetailsSuffix,
  readPositiveInt,
  readString,
} from "@/lib/ai/admin/control-plane-shared";

function requirePersonaRecord(value: unknown, fieldPath: string): Record<string, unknown> {
  const record = asRecord(value);
  if (!record) {
    throw new Error(`persona generation output missing ${fieldPath}`);
  }
  return record;
}

function assertExactKeys(
  record: Record<string, unknown>,
  fieldPath: string,
  allowed: string[],
): void {
  const allowedSet = new Set(allowed);
  const extra = Object.keys(record).filter((key) => !allowedSet.has(key));
  if (extra.length > 0) {
    throw new Error(
      `${fieldPath} contains forbidden key${extra.length === 1 ? "" : "s"} ${extra.join(", ")}`,
    );
  }
}

function requirePersonaText(value: unknown, fieldPath: string): string {
  const text = readString(value).trim();
  if (!text) {
    throw new Error(`persona generation output missing ${fieldPath}`);
  }
  return text;
}

function normalizePersonaStringArray(
  value: unknown,
  fieldPath: string,
  allowEmpty = false,
): string[] {
  const items =
    typeof value === "string"
      ? [value]
      : Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : null;
  if (!items) {
    throw new Error(`persona generation output missing ${fieldPath}`);
  }
  const normalized = items.map((item) => item.trim()).filter((item) => item.length > 0);
  if (normalized.length === 0 && !allowEmpty) {
    throw new Error(`persona generation output missing ${fieldPath}`);
  }
  return normalized;
}

function normalizeSingleLineText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function normalizePromptAssistNamedReferenceType(
  value: unknown,
): PromptAssistNamedReferenceType | null {
  const normalized = readString(value).trim();
  switch (normalized) {
    case "real_person":
    case "historical_figure":
    case "fictional_character":
    case "mythic_figure":
    case "iconic_persona":
      return normalized;
    default:
      return null;
  }
}

function countWords(text: string): number {
  const normalized = normalizeSingleLineText(text);
  if (!normalized) {
    return 0;
  }
  if (containsCjk(normalized)) {
    return Math.max(1, Math.ceil(normalized.length / 4));
  }
  return normalized.split(/\s+/u).filter(Boolean).length;
}

function looksLikeIdentifierLabel(text: string): boolean {
  const normalized = normalizeSingleLineText(text);
  if (!normalized) {
    return false;
  }
  return /^[a-z0-9]+(?:_[a-z0-9]+)+$/u.test(normalized);
}

function maybeAddIdentifierIssue(issues: string[], fieldPath: string, text: string) {
  if (looksLikeIdentifierLabel(text)) {
    issues.push(
      `${fieldPath} must be a natural-language description, not an identifier-style label.`,
    );
  }
}

function maybeAddInstructionIssue(issues: string[], fieldPath: string, text: string) {
  maybeAddIdentifierIssue(issues, fieldPath, text);
  if (countWords(text) < 3) {
    issues.push(
      `${fieldPath} must be a reusable natural-language instruction, not a compressed label.`,
    );
  }
}

function hasMixedScriptArtifact(text: string): boolean {
  return /[A-Za-z][\u3400-\u9fff]|[\u3400-\u9fff][A-Za-z]/u.test(text);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripAllowedReferenceNames(text: string, allowedReferenceNames: string[]): string {
  if (allowedReferenceNames.length === 0) {
    return text;
  }

  let normalized = text;
  for (const name of allowedReferenceNames) {
    const trimmed = name.trim();
    if (!trimmed) {
      continue;
    }
    normalized = normalized.replace(new RegExp(escapeRegExp(trimmed), "gu"), " ");
  }
  return normalized;
}

function collectAllowedReferenceNameVariants(referenceNames: string[]): string[] {
  const variants = new Set<string>();

  for (const name of referenceNames) {
    const trimmed = name.trim();
    if (!trimmed) {
      continue;
    }
    variants.add(trimmed);

    for (const part of trimmed.split(/[\s/_-]+/u)) {
      const token = part.trim();
      if (token.length < 4) {
        continue;
      }
      variants.add(token);
    }
  }

  return Array.from(variants).sort((left, right) => right.length - left.length);
}

function collectReferenceSourceNames(value: unknown): string[] {
  const record = asRecord(value);
  if (!record) {
    return [];
  }

  return [record.reference_sources, record.other_reference_sources]
    .flatMap((collection) => (Array.isArray(collection) ? collection : []))
    .map((item) => readString(asRecord(item)?.name).trim())
    .filter((item) => item.length > 0);
}

export function collectEnglishOnlyIssues(
  value: unknown,
  input?: {
    fieldPath?: string;
    allowedReferenceNames?: string[];
  },
): string[] {
  const fieldPath = input?.fieldPath ?? "";
  const allowedReferenceNamesRaw = collectAllowedReferenceNameVariants([
    ...(input?.allowedReferenceNames ?? []),
    ...collectReferenceSourceNames(value),
  ]);
  const issues: string[] = [];

  const visit = (current: unknown, currentPath: string) => {
    if (typeof current === "string") {
      if (containsCjk(stripAllowedReferenceNames(current, allowedReferenceNamesRaw))) {
        issues.push(`${currentPath} must be English-only.`);
      }
      return;
    }

    if (Array.isArray(current)) {
      current.forEach((item, index) => {
        visit(item, `${currentPath}[${index}]`);
      });
      return;
    }

    const record = asRecord(current);
    if (!record) {
      return;
    }

    for (const [key, item] of Object.entries(record)) {
      visit(item, currentPath ? `${currentPath}.${key}` : key);
    }
  };

  visit(value, fieldPath);
  return issues;
}

export function validateSeedStageQuality(stage: PersonaGenerationSeedStage): string[] {
  const issues: string[] = [];
  const allowedReferenceNamesRaw = collectAllowedReferenceNameVariants(
    stage.reference_sources.map((item) => item.name).filter(Boolean),
  );
  const seedTexts: Array<[string, string]> = [
    ["persona.bio", stage.persona.bio],
    ["identity_summary.core_motivation", readString(stage.identity_summary.core_motivation)],
    [
      "identity_summary.one_sentence_identity",
      readString(stage.identity_summary.one_sentence_identity),
    ],
    ["originalization_note", stage.originalization_note],
    ...stage.reference_derivation.map(
      (item, index) => [`reference_derivation[${index}]`, item] as [string, string],
    ),
  ];

  for (const [fieldPath, text] of seedTexts) {
    if (hasMixedScriptArtifact(stripAllowedReferenceNames(text, allowedReferenceNamesRaw))) {
      issues.push(
        `${fieldPath} contains a mixed-script artifact and must stay in one clean language register.`,
      );
    }
  }

  return issues;
}

type PersonaCoreValuesAndAesthetic = Pick<
  PersonaGenerationCoreStage,
  "values" | "aesthetic_profile"
>;

type PersonaCoreInteractionGuidance = Pick<
  PersonaGenerationCoreStage,
  "interaction_defaults" | "guardrails" | "voice_fingerprint" | "task_style_matrix"
>;

export function validateValuesStageQuality(stage: PersonaCoreValuesAndAesthetic): string[] {
  const issues: string[] = [];
  for (const [index, item] of (
    stage.values.value_hierarchy as Array<{ value: string; priority: number }>
  ).entries()) {
    maybeAddIdentifierIssue(issues, `values.value_hierarchy[${index}].value`, item.value);
  }
  maybeAddIdentifierIssue(issues, "values.judgment_style", readString(stage.values.judgment_style));
  for (const fieldName of [
    "humor_preferences",
    "narrative_preferences",
    "creative_preferences",
    "disliked_patterns",
    "taste_boundaries",
  ] as const) {
    const items = stage.aesthetic_profile[fieldName];
    if (!Array.isArray(items)) {
      continue;
    }
    for (const [index, item] of items.entries()) {
      maybeAddIdentifierIssue(issues, `aesthetic_profile.${fieldName}[${index}]`, readString(item));
    }
  }
  return issues;
}

export function validateInteractionStageQuality(stage: PersonaCoreInteractionGuidance): string[] {
  const issues: string[] = [];
  const taskStyleMatrix = stage.task_style_matrix as {
    post: Record<string, unknown>;
    comment: Record<string, unknown>;
  };
  const post = asRecord(taskStyleMatrix.post) ?? {};
  const comment = asRecord(taskStyleMatrix.comment) ?? {};
  maybeAddInstructionIssue(
    issues,
    "interaction_defaults.default_stance",
    readString(stage.interaction_defaults.default_stance),
  );
  for (const fieldName of [
    "discussion_strengths",
    "friction_triggers",
    "non_generic_traits",
  ] as const) {
    const items = stage.interaction_defaults[fieldName];
    if (!Array.isArray(items)) {
      continue;
    }
    for (const [index, item] of items.entries()) {
      maybeAddIdentifierIssue(
        issues,
        `interaction_defaults.${fieldName}[${index}]`,
        readString(item),
      );
    }
  }

  maybeAddInstructionIssue(
    issues,
    "voice_fingerprint.opening_move",
    readString(stage.voice_fingerprint.opening_move),
  );
  for (const [index, item] of (stage.voice_fingerprint.metaphor_domains as unknown[]).entries()) {
    maybeAddIdentifierIssue(
      issues,
      `voice_fingerprint.metaphor_domains[${index}]`,
      readString(item),
    );
  }
  maybeAddInstructionIssue(
    issues,
    "voice_fingerprint.attack_style",
    readString(stage.voice_fingerprint.attack_style),
  );
  maybeAddInstructionIssue(
    issues,
    "voice_fingerprint.praise_style",
    readString(stage.voice_fingerprint.praise_style),
  );
  maybeAddInstructionIssue(
    issues,
    "voice_fingerprint.closing_move",
    readString(stage.voice_fingerprint.closing_move),
  );
  for (const [index, item] of (stage.voice_fingerprint.forbidden_shapes as unknown[]).entries()) {
    maybeAddIdentifierIssue(
      issues,
      `voice_fingerprint.forbidden_shapes[${index}]`,
      readString(item),
    );
  }

  maybeAddInstructionIssue(
    issues,
    "task_style_matrix.post.entry_shape",
    readString(post.entry_shape),
  );
  maybeAddInstructionIssue(
    issues,
    "task_style_matrix.post.body_shape",
    readString(post.body_shape),
  );
  maybeAddInstructionIssue(
    issues,
    "task_style_matrix.post.close_shape",
    readString(post.close_shape),
  );
  for (const [index, item] of ((post.forbidden_shapes as unknown[]) ?? []).entries()) {
    maybeAddIdentifierIssue(
      issues,
      `task_style_matrix.post.forbidden_shapes[${index}]`,
      readString(item),
    );
  }

  maybeAddInstructionIssue(
    issues,
    "task_style_matrix.comment.entry_shape",
    readString(comment.entry_shape),
  );
  maybeAddInstructionIssue(
    issues,
    "task_style_matrix.comment.feedback_shape",
    readString(comment.feedback_shape),
  );
  maybeAddInstructionIssue(
    issues,
    "task_style_matrix.comment.close_shape",
    readString(comment.close_shape),
  );
  for (const [index, item] of ((comment.forbidden_shapes as unknown[]) ?? []).entries()) {
    maybeAddIdentifierIssue(
      issues,
      `task_style_matrix.comment.forbidden_shapes[${index}]`,
      readString(item),
    );
  }

  return issues;
}

export function validatePersonaCoreStageQuality(stage: PersonaGenerationCoreStage): string[] {
  const issues: string[] = [];
  issues.push(
    ...validateValuesStageQuality({
      values: stage.values,
      aesthetic_profile: stage.aesthetic_profile,
    }),
  );
  issues.push(
    ...validateInteractionStageQuality({
      interaction_defaults: stage.interaction_defaults,
      guardrails: stage.guardrails,
      voice_fingerprint: stage.voice_fingerprint,
      task_style_matrix: stage.task_style_matrix,
    }),
  );

  const worldview = normalizePersonaStringArray(stage.values.worldview, "values.worldview");
  const discussionStrengths = normalizePersonaStringArray(
    stage.interaction_defaults.discussion_strengths,
    "interaction_defaults.discussion_strengths",
  );
  const nonGenericTraits = normalizePersonaStringArray(
    stage.interaction_defaults.non_generic_traits,
    "interaction_defaults.non_generic_traits",
  );
  const admiredCreatorTypes = normalizePersonaStringArray(
    stage.creator_affinity.admired_creator_types,
    "creator_affinity.admired_creator_types",
  );
  const openingMove = readString(stage.voice_fingerprint.opening_move);
  const postBodyShape = readString(asRecord(stage.task_style_matrix.post)?.body_shape);
  const commentFeedbackShape = readString(
    asRecord(stage.task_style_matrix.comment)?.feedback_shape,
  );

  if (worldview.length === 0) {
    issues.push("values.worldview must contain at least one worldview statement.");
  }
  if (discussionStrengths.length === 0) {
    issues.push("interaction_defaults.discussion_strengths must contain at least one item.");
  }
  if (nonGenericTraits.length === 0) {
    issues.push("interaction_defaults.non_generic_traits must contain at least one item.");
  }
  if (admiredCreatorTypes.length === 0) {
    issues.push("creator_affinity.admired_creator_types must contain at least one item.");
  }
  if (countWords(openingMove) < 5) {
    issues.push(
      "voice_fingerprint.opening_move must provide enough signal for downstream discourse projection.",
    );
  }
  if (countWords(postBodyShape) < 3) {
    issues.push(
      "task_style_matrix.post.body_shape must provide enough signal for downstream discourse projection.",
    );
  }
  if (countWords(commentFeedbackShape) < 3) {
    issues.push(
      "task_style_matrix.comment.feedback_shape must provide enough signal for downstream discourse projection.",
    );
  }

  const doctrineSignalCount =
    worldview.length +
    discussionStrengths.length +
    nonGenericTraits.length +
    admiredCreatorTypes.length;
  if (doctrineSignalCount < 4) {
    issues.push(
      "persona_core must provide enough cross-field signal for value_fit, reasoning_fit, discourse_fit, and expression_fit derivation.",
    );
  }

  return issues;
}

function normalizePersonaValueHierarchy(
  value: unknown,
  fieldPath: string,
): Array<{ value: string; priority: number }> {
  const arrayRows = Array.isArray(value)
    ? value
        .map((item, index) => {
          const row = asRecord(item);
          if (!row) {
            return null;
          }
          const label = readString(row.value).trim();
          const explicitPriority = readPositiveInt(row.priority, 0);
          const priority = explicitPriority >= 1 ? explicitPriority : index + 1;
          if (!label) {
            return null;
          }
          return { value: label, priority };
        })
        .filter((item): item is { value: string; priority: number } => item !== null)
    : [];

  if (arrayRows.length > 0) {
    return arrayRows.sort((a, b) => a.priority - b.priority || a.value.localeCompare(b.value));
  }

  const recordRows = asRecord(value);
  if (!recordRows) {
    throw new Error(`persona generation output missing ${fieldPath}`);
  }
  const normalized = Object.entries(recordRows)
    .map(([priorityRaw, labelValue]) => {
      const label = readString(labelValue).trim();
      const priority = readPositiveInt(priorityRaw, 0);
      if (!label || priority < 1) {
        return null;
      }
      return { value: label, priority };
    })
    .filter((item): item is { value: string; priority: number } => item !== null)
    .sort((a, b) => a.priority - b.priority || a.value.localeCompare(b.value));

  if (normalized.length === 0) {
    throw new Error(`persona generation output missing ${fieldPath}`);
  }
  return normalized;
}

function parsePersonaIdentitySummary(
  value: unknown,
  fieldPath = "persona_core.identity_summary",
): Record<string, unknown> {
  const root = requirePersonaRecord(value, fieldPath);
  assertExactKeys(root, fieldPath, ["archetype", "core_motivation", "one_sentence_identity"]);
  return {
    archetype: requirePersonaText(root.archetype, `${fieldPath}.archetype`),
    core_motivation: requirePersonaText(root.core_motivation, `${fieldPath}.core_motivation`),
    one_sentence_identity: requirePersonaText(
      root.one_sentence_identity,
      `${fieldPath}.one_sentence_identity`,
    ),
  };
}

function parsePersonaValues(
  value: unknown,
  fieldPath = "persona_core.values",
): Record<string, unknown> {
  const root = requirePersonaRecord(value, fieldPath);
  assertExactKeys(root, fieldPath, ["value_hierarchy", "worldview", "judgment_style"]);
  return {
    value_hierarchy: normalizePersonaValueHierarchy(
      root.value_hierarchy,
      `${fieldPath}.value_hierarchy`,
    ),
    worldview: normalizePersonaStringArray(root.worldview, `${fieldPath}.worldview`),
    judgment_style: requirePersonaText(root.judgment_style, `${fieldPath}.judgment_style`),
  };
}

function parsePersonaAestheticProfile(
  value: unknown,
  fieldPath = "persona_core.aesthetic_profile",
): Record<string, unknown> {
  const root = requirePersonaRecord(value, fieldPath);
  assertExactKeys(root, fieldPath, [
    "humor_preferences",
    "narrative_preferences",
    "creative_preferences",
    "disliked_patterns",
    "taste_boundaries",
  ]);
  return {
    humor_preferences: normalizePersonaStringArray(
      root.humor_preferences,
      `${fieldPath}.humor_preferences`,
    ),
    narrative_preferences: normalizePersonaStringArray(
      root.narrative_preferences,
      `${fieldPath}.narrative_preferences`,
    ),
    creative_preferences: normalizePersonaStringArray(
      root.creative_preferences,
      `${fieldPath}.creative_preferences`,
    ),
    disliked_patterns: normalizePersonaStringArray(
      root.disliked_patterns,
      `${fieldPath}.disliked_patterns`,
    ),
    taste_boundaries: normalizePersonaStringArray(
      root.taste_boundaries,
      `${fieldPath}.taste_boundaries`,
    ),
  };
}

function parsePersonaLivedContext(
  value: unknown,
  fieldPath = "persona_core.lived_context",
): Record<string, unknown> {
  const root = requirePersonaRecord(value, fieldPath);
  assertExactKeys(root, fieldPath, [
    "familiar_scenes_of_life",
    "personal_experience_flavors",
    "cultural_contexts",
    "topics_with_confident_grounding",
    "topics_requiring_runtime_retrieval",
  ]);
  return {
    familiar_scenes_of_life: normalizePersonaStringArray(
      root.familiar_scenes_of_life,
      `${fieldPath}.familiar_scenes_of_life`,
    ),
    personal_experience_flavors: normalizePersonaStringArray(
      root.personal_experience_flavors,
      `${fieldPath}.personal_experience_flavors`,
    ),
    cultural_contexts: normalizePersonaStringArray(
      root.cultural_contexts,
      `${fieldPath}.cultural_contexts`,
    ),
    topics_with_confident_grounding: normalizePersonaStringArray(
      root.topics_with_confident_grounding,
      `${fieldPath}.topics_with_confident_grounding`,
    ),
    topics_requiring_runtime_retrieval: normalizePersonaStringArray(
      root.topics_requiring_runtime_retrieval,
      `${fieldPath}.topics_requiring_runtime_retrieval`,
    ),
  };
}

function parsePersonaCreatorAffinity(
  value: unknown,
  fieldPath = "persona_core.creator_affinity",
): Record<string, unknown> {
  const root = requirePersonaRecord(value, fieldPath);
  assertExactKeys(root, fieldPath, [
    "admired_creator_types",
    "structural_preferences",
    "detail_selection_habits",
    "creative_biases",
  ]);
  return {
    admired_creator_types: normalizePersonaStringArray(
      root.admired_creator_types,
      `${fieldPath}.admired_creator_types`,
    ),
    structural_preferences: normalizePersonaStringArray(
      root.structural_preferences,
      `${fieldPath}.structural_preferences`,
    ),
    detail_selection_habits: normalizePersonaStringArray(
      root.detail_selection_habits,
      `${fieldPath}.detail_selection_habits`,
    ),
    creative_biases: normalizePersonaStringArray(
      root.creative_biases,
      `${fieldPath}.creative_biases`,
    ),
  };
}

function parsePersonaInteractionDefaults(
  value: unknown,
  fieldPath = "persona_core.interaction_defaults",
): Record<string, unknown> {
  const root = requirePersonaRecord(value, fieldPath);
  assertExactKeys(root, fieldPath, [
    "default_stance",
    "discussion_strengths",
    "friction_triggers",
    "non_generic_traits",
  ]);
  return {
    default_stance: requirePersonaText(root.default_stance, `${fieldPath}.default_stance`),
    discussion_strengths: normalizePersonaStringArray(
      root.discussion_strengths,
      `${fieldPath}.discussion_strengths`,
    ),
    friction_triggers: normalizePersonaStringArray(
      root.friction_triggers,
      `${fieldPath}.friction_triggers`,
    ),
    non_generic_traits: normalizePersonaStringArray(
      root.non_generic_traits,
      `${fieldPath}.non_generic_traits`,
    ),
  };
}

function parsePersonaGuardrails(
  value: unknown,
  fieldPath = "persona_core.guardrails",
): Record<string, unknown> {
  const root = requirePersonaRecord(value, fieldPath);
  assertExactKeys(root, fieldPath, ["hard_no", "deescalation_style"]);
  return {
    hard_no: normalizePersonaStringArray(root.hard_no, `${fieldPath}.hard_no`),
    deescalation_style: normalizePersonaStringArray(
      root.deescalation_style,
      `${fieldPath}.deescalation_style`,
    ),
  };
}

function parsePersonaVoiceFingerprint(
  value: unknown,
  fieldPath = "persona_core.voice_fingerprint",
): Record<string, unknown> {
  const root = requirePersonaRecord(value, fieldPath);
  assertExactKeys(root, fieldPath, [
    "opening_move",
    "metaphor_domains",
    "attack_style",
    "praise_style",
    "closing_move",
    "forbidden_shapes",
  ]);
  return {
    opening_move: requirePersonaText(root.opening_move, `${fieldPath}.opening_move`),
    metaphor_domains: normalizePersonaStringArray(
      root.metaphor_domains,
      `${fieldPath}.metaphor_domains`,
    ),
    attack_style: requirePersonaText(root.attack_style, `${fieldPath}.attack_style`),
    praise_style: requirePersonaText(root.praise_style, `${fieldPath}.praise_style`),
    closing_move: requirePersonaText(root.closing_move, `${fieldPath}.closing_move`),
    forbidden_shapes: normalizePersonaStringArray(
      root.forbidden_shapes,
      `${fieldPath}.forbidden_shapes`,
    ),
  };
}

function parsePersonaTaskStyleMatrix(
  value: unknown,
  fieldPath = "persona_core.task_style_matrix",
): Record<string, unknown> {
  const root = requirePersonaRecord(value, fieldPath);
  assertExactKeys(root, fieldPath, ["post", "comment"]);
  const post = requirePersonaRecord(root.post, `${fieldPath}.post`);
  const comment = requirePersonaRecord(root.comment, `${fieldPath}.comment`);
  assertExactKeys(post, `${fieldPath}.post`, [
    "entry_shape",
    "body_shape",
    "close_shape",
    "forbidden_shapes",
  ]);
  assertExactKeys(comment, `${fieldPath}.comment`, [
    "entry_shape",
    "feedback_shape",
    "close_shape",
    "forbidden_shapes",
  ]);
  return {
    post: {
      entry_shape: requirePersonaText(post.entry_shape, `${fieldPath}.post.entry_shape`),
      body_shape: requirePersonaText(post.body_shape, `${fieldPath}.post.body_shape`),
      close_shape: requirePersonaText(post.close_shape, `${fieldPath}.post.close_shape`),
      forbidden_shapes: normalizePersonaStringArray(
        post.forbidden_shapes,
        `${fieldPath}.post.forbidden_shapes`,
      ),
    },
    comment: {
      entry_shape: requirePersonaText(comment.entry_shape, `${fieldPath}.comment.entry_shape`),
      feedback_shape: requirePersonaText(
        comment.feedback_shape,
        `${fieldPath}.comment.feedback_shape`,
      ),
      close_shape: requirePersonaText(comment.close_shape, `${fieldPath}.comment.close_shape`),
      forbidden_shapes: normalizePersonaStringArray(
        comment.forbidden_shapes,
        `${fieldPath}.comment.forbidden_shapes`,
      ),
    },
  };
}

export function parsePersonaCore(value: unknown): Record<string, unknown> {
  const root = requirePersonaRecord(value, "persona_core");
  assertExactKeys(root, "persona_core", [
    "identity_summary",
    "values",
    "aesthetic_profile",
    "lived_context",
    "creator_affinity",
    "interaction_defaults",
    "guardrails",
    "voice_fingerprint",
    "task_style_matrix",
  ]);
  return {
    identity_summary: parsePersonaIdentitySummary(root.identity_summary),
    values: parsePersonaValues(root.values),
    aesthetic_profile: parsePersonaAestheticProfile(root.aesthetic_profile),
    lived_context: parsePersonaLivedContext(root.lived_context),
    creator_affinity: parsePersonaCreatorAffinity(root.creator_affinity),
    interaction_defaults: parsePersonaInteractionDefaults(root.interaction_defaults),
    guardrails: parsePersonaGuardrails(root.guardrails),
    voice_fingerprint: parsePersonaVoiceFingerprint(root.voice_fingerprint),
    task_style_matrix: parsePersonaTaskStyleMatrix(root.task_style_matrix),
  };
}

export function parseStoredPersonaCoreProfile(value: unknown): Record<string, unknown> {
  const root = requirePersonaRecord(value, "persona_core");
  const coreRoot = {
    identity_summary: root.identity_summary,
    values: root.values,
    aesthetic_profile: root.aesthetic_profile,
    lived_context: root.lived_context,
    creator_affinity: root.creator_affinity,
    interaction_defaults: root.interaction_defaults,
    guardrails: root.guardrails,
    voice_fingerprint: root.voice_fingerprint,
    task_style_matrix: root.task_style_matrix,
  };
  return {
    ...parsePersonaCore(coreRoot),
    reference_sources: parseReferenceSources(root.reference_sources ?? [], {
      allowEmpty: true,
      fieldPath: "persona_core.reference_sources",
    }),
    other_reference_sources: parseOtherReferenceSources(root.other_reference_sources ?? [], {
      fieldPath: "persona_core.other_reference_sources",
    }),
    reference_derivation: normalizePersonaStringArray(
      root.reference_derivation ?? [],
      "persona_core.reference_derivation",
      true,
    ),
    originalization_note: requirePersonaText(
      root.originalization_note,
      "persona_core.originalization_note",
    ),
  };
}

function parseReferenceSourceArray(
  value: unknown,
  input: {
    fieldPath: string;
    allowEmpty?: boolean;
  },
): PersonaGenerationStructured["reference_sources"] {
  if (!Array.isArray(value)) {
    throw new Error(`persona generation output missing ${input.fieldPath}`);
  }
  const normalized = value
    .map((item) => {
      const row = requirePersonaRecord(item, input.fieldPath);
      const name = requirePersonaText(row.name, `${input.fieldPath}.name`);
      const type = requirePersonaText(row.type, `${input.fieldPath}.type`);
      const contribution = normalizePersonaStringArray(
        row.contribution,
        `${input.fieldPath}.contribution`,
      );
      return { name, type, contribution };
    })
    .filter((item) => item.name.length > 0);
  if (normalized.length === 0 && !input.allowEmpty) {
    throw new Error(`persona generation output missing ${input.fieldPath}`);
  }
  return normalized;
}

export function parseReferenceSources(
  value: unknown,
  options?: {
    fieldPath?: string;
    allowEmpty?: boolean;
  },
): PersonaGenerationStructured["reference_sources"] {
  return parseReferenceSourceArray(value, {
    fieldPath: options?.fieldPath ?? "reference_sources",
    allowEmpty: options?.allowEmpty ?? false,
  });
}

export function parseOtherReferenceSources(
  value: unknown,
  options?: {
    fieldPath?: string;
  },
): PersonaGenerationStructured["other_reference_sources"] {
  return parseReferenceSourceArray(value, {
    fieldPath: options?.fieldPath ?? "other_reference_sources",
    allowEmpty: true,
  });
}

export function extractJsonFromText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }
  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i) ?? trimmed.match(/```\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  return trimmed;
}

export function containsCjk(text: string): boolean {
  return /[\u3400-\u9fff]/u.test(text);
}

export function hasLikelyNamedReference(text: string): boolean {
  const normalized = normalizeSingleLineText(text);
  if (!normalized) {
    return false;
  }

  return (
    /^[A-Z][\p{L}'-]{2,}$/u.test(normalized) ||
    /(?:參考|参考|像|例如|比如)\s*[:：]?\s*[\p{L}]/u.test(normalized) ||
    /\b(?:inspired by|reference|references|like|such as)\b\s*[:：]?\s*(?:[A-Z][\p{L}'-]*|[\u3400-\u9fff])/u.test(
      normalized,
    ) ||
    /\b[A-Z][\p{L}'-]{2,}(?:-inspired|'s)\b/u.test(normalized) ||
    /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b/.test(normalized) ||
    /\b(?:Fleabag|Sherlock|Batman|Madonna|Björk|Kafka|Murakami|Didion|Grisham|Musk)\b/.test(
      normalized,
    ) ||
    /(?:伊坂幸太郎|村上春樹|宮藤官九郎|是枝裕和|昆汀|王家衛|芙莉貝格)/u.test(normalized)
  );
}

export function extractLikelyNamedReferences(text: string): string[] {
  const normalized = normalizeSingleLineText(text);
  if (!normalized) {
    return [];
  }

  const matches = new Set<string>();
  if (/^[A-Z][\p{L}'-]{2,}$/u.test(normalized)) {
    matches.add(normalized);
  }
  for (const match of normalized.matchAll(/\b([A-Z][\p{L}'-]{2,})(?:-inspired|'s)\b/gu)) {
    if (match[1]) {
      matches.add(match[1].trim());
    }
  }
  for (const match of normalized.matchAll(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b/g)) {
    if (match[0]) {
      matches.add(match[0].trim());
    }
  }
  for (const match of normalized.matchAll(
    /\b(?:Fleabag|Sherlock|Batman|Madonna|Björk|Kafka|Murakami|Didion|Grisham|Musk)\b/g,
  )) {
    if (match[0]) {
      matches.add(match[0].trim());
    }
  }
  for (const match of normalized.matchAll(
    /(?:伊坂幸太郎|村上春樹|宮藤官九郎|是枝裕和|昆汀|王家衛|芙莉貝格)/gu,
  )) {
    if (match[0]) {
      matches.add(match[0].trim());
    }
  }

  return Array.from(matches);
}

export function buildExplicitSourceReferenceInstruction(
  sourceReferenceNames: string[],
): string | null {
  if (sourceReferenceNames.length === 0) {
    return null;
  }

  return [
    `The user explicitly referenced these names: ${sourceReferenceNames.join(", ")}.`,
    "Keep at least 1 of those exact names explicit in the final brief whenever possible.",
    "If the user's input is only a name or short list of names, still write a full persona brief around those names instead of replacing them with anonymous description.",
    "If you swap to a closely related reference, keep that related name explicit in the final brief.",
  ].join(" ");
}

export function parsePromptAssistReferenceResolutionOutput(
  rawText: string,
): PromptAssistReferenceResolutionOutput {
  const jsonText = extractJsonFromText(rawText);
  if (!jsonText) {
    throw new Error("prompt assist output is empty");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("prompt assist output must be valid JSON");
  }

  const record = asRecord(parsed);
  if (!record) {
    throw new Error("prompt assist output must be a JSON object");
  }

  const namedReferencesRaw = Array.isArray(record.namedReferences) ? record.namedReferences : null;
  if (!namedReferencesRaw) {
    throw new Error("prompt assist output missing namedReferences");
  }

  const namedReferences = namedReferencesRaw
    .map((item) => {
      const reference = asRecord(item);
      if (!reference) {
        return null;
      }
      const name = normalizeSingleLineText(readString(reference.name));
      const type = normalizePromptAssistNamedReferenceType(reference.type);
      if (!name || !type) {
        return null;
      }
      return { name, type };
    })
    .filter(
      (item): item is PromptAssistReferenceResolutionOutput["namedReferences"][number] =>
        item !== null,
    );

  if (namedReferences.length === 0) {
    throw new Error("prompt assist output missing namedReferences");
  }

  return {
    namedReferences,
  };
}

export function assemblePromptAssistText(
  text: string,
  namedReferences: PromptAssistNamedReference[],
): string {
  const normalizedText = normalizeSingleLineText(text);
  const normalizedNames = namedReferences
    .map((item) => normalizeSingleLineText(item.name))
    .filter((item) => item.length > 0)
    .filter((item, index, list) => list.indexOf(item) === index);

  if (normalizedNames.length === 0) {
    return normalizedText;
  }

  const textWithTerminalPunctuation = /[.!?。！？]$/.test(normalizedText)
    ? normalizedText
    : `${normalizedText}.`;

  return `${textWithTerminalPunctuation} Reference sources: ${normalizedNames.join(", ")}.`;
}

function normalizePromptAssistComparisonText(text: string): string {
  return normalizeSingleLineText(text)
    .toLowerCase()
    .replace(/[“”"'`.,!?;:(){}\[\]<>，。！？；：「」『』（）【】]/gu, "")
    .trim();
}

function stripTrailingReferenceAppendix(text: string): string {
  return normalizeSingleLineText(text)
    .replace(
      /\s*\b(?:reference|references|inspired by|like|such as)\b\s+(?:[A-Z][^.?!]*|[\u3400-\u9fff][^.?!]*)[.?!]?$/u,
      "",
    )
    .replace(/\s*(?:參考|参考|像|例如|比如)\s*[^。！？」]+[。！？]?$/u, "")
    .trim();
}

function looksLikeImperativePersonaRequest(text: string): boolean {
  const normalized = normalizeSingleLineText(text);
  return (
    /^(?:generate|create|write|craft|build)\b/i.test(normalized) ||
    /^(?:請)?(?:生成|產生|建立|打造|寫出)/u.test(normalized)
  );
}

export function isWeakPromptAssistRewrite(input: {
  text: string;
  mode: "random" | "optimize";
  sourceText: string;
}): boolean {
  if (input.mode !== "optimize") {
    return false;
  }

  const normalizedOutput = normalizeSingleLineText(input.text);
  const normalizedSource = normalizeSingleLineText(input.sourceText);
  if (!normalizedOutput) {
    return true;
  }

  if (looksLikeImperativePersonaRequest(normalizedOutput)) {
    return true;
  }

  const outputWithoutReference = stripTrailingReferenceAppendix(normalizedOutput);
  if (
    normalizePromptAssistComparisonText(outputWithoutReference) ===
    normalizePromptAssistComparisonText(normalizedSource)
  ) {
    return true;
  }

  const sourceHasReference = hasLikelyNamedReference(normalizedSource);
  const outputHasReference = hasLikelyNamedReference(normalizedOutput);
  if (!sourceHasReference && outputHasReference) {
    const sourceComparable = normalizePromptAssistComparisonText(normalizedSource);
    const outputComparable = normalizePromptAssistComparisonText(outputWithoutReference);
    if (outputComparable === sourceComparable) {
      return true;
    }
  }

  return false;
}

export function isLikelyTruncatedPromptAssistText(input: {
  text: string;
  details?: Record<string, unknown> | null;
}): boolean {
  const normalized = normalizeSingleLineText(input.text);
  if (!normalized) {
    return false;
  }

  const finishReason = readString(input.details?.finishReason).trim().toLowerCase();
  if (finishReason === "length") {
    return true;
  }

  if (/[,:;\/\-(]$/.test(normalized)) {
    return true;
  }

  if (
    /\b(?:and|or|with|to|for|of|in|on|by|but|as|than|that|which|who|when|while|if|because)$/i.test(
      normalized,
    )
  ) {
    return true;
  }

  return false;
}

export function validatePromptAssistResult(input: {
  text: string;
  mode: "random" | "optimize";
  sourceText: string;
  details?: Record<string, unknown> | null;
}): string {
  const normalized = normalizeSingleLineText(input.text);
  if (!normalized) {
    throw new PromptAssistError({
      code: "prompt_assist_final_output_empty",
      message: "prompt assist final output was empty",
      details: input.details ?? null,
    });
  }
  if (isWeakPromptAssistRewrite(input)) {
    throw new PromptAssistError({
      code: "prompt_assist_output_too_weak",
      message: "prompt assist output is too weak",
      details: input.details ?? null,
    });
  }
  return normalized;
}

export function buildPromptAssistProviderError(input: {
  stage: PromptAssistAttemptStage;
  error: string;
  details: Record<string, unknown>;
  errorDetails?: unknown;
}): PromptAssistError {
  const suffix = buildLlmErrorDetailsSuffix(input.errorDetails);
  if (input.error.startsWith("LLM_TIMEOUT_")) {
    return new PromptAssistError({
      code: "prompt_assist_provider_timeout",
      message: `prompt assist provider timed out during ${input.stage} before returning text${suffix}`,
      details: input.details,
    });
  }

  return new PromptAssistError({
    code: "prompt_assist_provider_failed",
    message: `prompt assist provider failed during ${input.stage} before returning text: ${input.error}${suffix}`,
    details: input.details,
  });
}

export function buildPromptAssistAttemptDetails(input: {
  stage: PromptAssistAttemptStage;
  llmResult: {
    text: string;
    finishReason?: string | null;
    providerId?: string | null;
    modelId?: string | null;
    attempts?: number | null;
    usedFallback?: boolean | null;
    error?: string | null;
    errorDetails?: unknown;
  };
}): Record<string, unknown> {
  const trimmedText = input.llmResult.text.trim();
  return {
    attemptStage: input.stage,
    providerId: input.llmResult.providerId ?? null,
    modelId: input.llmResult.modelId ?? null,
    finishReason: input.llmResult.finishReason ?? null,
    hadText: trimmedText.length > 0,
    rawText: trimmedText.length > 0 ? trimmedText : null,
    attempts: input.llmResult.attempts ?? null,
    usedFallback: input.llmResult.usedFallback ?? false,
    ...(input.llmResult.error ? { providerError: input.llmResult.error } : {}),
    ...(input.llmResult.errorDetails ? { errorDetails: input.llmResult.errorDetails } : {}),
  };
}

function parsePersonaStageObject(rawText: string): Record<string, unknown> {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new PersonaGenerationParseError("persona generation output is empty", rawText);
  }
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    throw new PersonaGenerationParseError(
      "persona generation output must be a raw JSON object",
      rawText,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new PersonaGenerationParseError("persona generation output must be valid JSON", rawText);
  }

  const record = asRecord(parsed);
  if (!record) {
    throw new PersonaGenerationParseError(
      "persona generation output must be a JSON object",
      rawText,
    );
  }
  return record;
}

export function parsePersonaGenerationSemanticAuditResult(
  rawText: string,
): PersonaGenerationSemanticAuditResult {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new PersonaGenerationParseError(
      "persona generation semantic audit returned empty output",
      rawText,
    );
  }
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    throw new PersonaGenerationParseError(
      "persona generation semantic audit must be a raw JSON object",
      rawText,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new PersonaGenerationParseError(
      "persona generation semantic audit returned invalid JSON",
      rawText,
    );
  }

  const record = asRecord(parsed);
  if (!record) {
    throw new PersonaGenerationParseError(
      "persona generation semantic audit must return a JSON object",
      rawText,
    );
  }
  try {
    assertExactKeys(record, "semantic audit", [
      "passes",
      "issues",
      "repairGuidance",
      "keptReferenceNames",
    ]);
  } catch (error) {
    throw new PersonaGenerationParseError(
      error instanceof Error ? error.message : "persona generation semantic audit is invalid",
      rawText,
    );
  }

  const issuesRaw = Array.isArray(record.issues) ? record.issues : null;
  const repairGuidanceRaw = Array.isArray(record.repairGuidance) ? record.repairGuidance : null;
  const keptReferenceNamesRaw = Array.isArray(record.keptReferenceNames)
    ? record.keptReferenceNames
    : null;
  if (typeof record.passes !== "boolean" || issuesRaw === null || repairGuidanceRaw === null) {
    throw new PersonaGenerationParseError(
      "persona generation semantic audit must include boolean passes and string-array issues/repairGuidance",
      rawText,
    );
  }

  return {
    passes: record.passes,
    ...(keptReferenceNamesRaw
      ? {
          keptReferenceNames: keptReferenceNamesRaw
            .map((item) => (typeof item === "string" ? item.trim() : ""))
            .filter((item) => item.length > 0),
        }
      : {}),
    issues: issuesRaw
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0),
    repairGuidance: repairGuidanceRaw
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0),
  };
}

export function parsePersonaSeedOutput(rawText: string): PersonaGenerationSeedStage {
  try {
    const record = parsePersonaStageObject(rawText);
    assertExactKeys(record, "seed", [
      "persona",
      "identity_summary",
      "reference_sources",
      "other_reference_sources",
      "reference_derivation",
      "originalization_note",
    ]);
    const persona = requirePersonaRecord(record.persona, "persona");
    return {
      persona: {
        display_name: requirePersonaText(persona.display_name, "persona.display_name"),
        bio: requirePersonaText(persona.bio, "persona.bio"),
        status: "active",
      },
      identity_summary: parsePersonaIdentitySummary(record.identity_summary, "identity_summary"),
      reference_sources: parseReferenceSources(record.reference_sources, {
        allowEmpty: true,
      }),
      other_reference_sources: parseOtherReferenceSources(record.other_reference_sources),
      reference_derivation: normalizePersonaStringArray(
        record.reference_derivation,
        "reference_derivation",
      ),
      originalization_note: requirePersonaText(record.originalization_note, "originalization_note"),
    };
  } catch (error) {
    throw new PersonaGenerationParseError(
      error instanceof Error ? error.message : "persona generation output is invalid",
      rawText,
    );
  }
}

export function parsePersonaCoreStageOutput(rawText: string): PersonaGenerationCoreStage {
  const record = parsePersonaStageObject(rawText);
  try {
    assertExactKeys(record, "persona_core", [
      "values",
      "aesthetic_profile",
      "lived_context",
      "creator_affinity",
      "interaction_defaults",
      "guardrails",
      "voice_fingerprint",
      "task_style_matrix",
    ]);
    return {
      values: parsePersonaValues(record.values, "persona_core.values"),
      aesthetic_profile: parsePersonaAestheticProfile(
        record.aesthetic_profile,
        "persona_core.aesthetic_profile",
      ),
      lived_context: parsePersonaLivedContext(record.lived_context, "persona_core.lived_context"),
      creator_affinity: parsePersonaCreatorAffinity(
        record.creator_affinity,
        "persona_core.creator_affinity",
      ),
      interaction_defaults: parsePersonaInteractionDefaults(
        record.interaction_defaults,
        "persona_core.interaction_defaults",
      ),
      guardrails: parsePersonaGuardrails(record.guardrails, "persona_core.guardrails"),
      voice_fingerprint: parsePersonaVoiceFingerprint(
        record.voice_fingerprint,
        "persona_core.voice_fingerprint",
      ),
      task_style_matrix: parsePersonaTaskStyleMatrix(
        record.task_style_matrix,
        "persona_core.task_style_matrix",
      ),
    };
  } catch (error) {
    throw new PersonaGenerationParseError(
      error instanceof Error ? error.message : "persona generation output is invalid",
      rawText,
    );
  }
}

export function parsePersonaGenerationOutput(rawText: string): {
  structured: PersonaGenerationStructured;
} {
  const record = parsePersonaStageObject(rawText);
  try {
    assertExactKeys(record, "persona_generation", [
      "persona",
      "persona_core",
      "reference_sources",
      "other_reference_sources",
      "reference_derivation",
      "originalization_note",
    ]);
    const persona = requirePersonaRecord(record.persona, "persona");
    const personaCore = requirePersonaRecord(record.persona_core, "persona_core");
    return {
      structured: {
        persona: {
          display_name: requirePersonaText(persona.display_name, "persona.display_name"),
          bio: requirePersonaText(persona.bio, "persona.bio"),
          status: "active",
        },
        persona_core: parsePersonaCore(personaCore),
        reference_sources: parseReferenceSources(record.reference_sources, {
          allowEmpty: true,
        }),
        other_reference_sources: parseOtherReferenceSources(record.other_reference_sources),
        reference_derivation: normalizePersonaStringArray(
          record.reference_derivation,
          "reference_derivation",
        ),
        originalization_note: requirePersonaText(
          record.originalization_note,
          "originalization_note",
        ),
      },
    };
  } catch (error) {
    if (error instanceof PersonaGenerationParseError) {
      throw error;
    }
    throw new PersonaGenerationParseError(
      error instanceof Error ? error.message : "persona generation output is invalid",
      rawText,
    );
  }
}

export function parseQualityRepairDelta(rawText: string): {
  repair: Record<string, unknown>;
} {
  const jsonText = extractJsonFromText(rawText);
  if (!jsonText) {
    throw new Error("quality repair delta output is empty");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("quality repair delta output must be valid JSON");
  }

  const record = asRecord(parsed);
  if (!record) {
    throw new Error("quality repair delta output must be a JSON object");
  }

  const repairRecord = asRecord(record.repair);
  if (!repairRecord || Object.keys(repairRecord).length === 0) {
    throw new Error("quality repair delta must contain a non-empty repair object");
  }

  return { repair: repairRecord };
}
