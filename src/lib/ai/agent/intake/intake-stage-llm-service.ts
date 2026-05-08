import {
  asRecord,
  readBoolean,
  readNumberOrNull,
  readString,
} from "@/lib/ai/admin/control-plane-shared";
import {
  buildCandidateStagePrompt,
  buildOpportunityStagePrompt,
  buildSelectorInputPreview,
} from "@/lib/ai/agent/intake/intake-preview";
import type {
  AiOppProbabilityUpdateInput,
  AiOppRow,
} from "@/lib/ai/agent/intake/opportunity-store";
import { createDbBackedLlmProviderRegistry } from "@/lib/ai/llm/default-registry";
import { invokeLLM } from "@/lib/ai/llm/invoke-llm";
import { invokeStructuredLLM } from "@/lib/ai/llm/invoke-structured-llm";
import { resolveLlmInvocationConfig } from "@/lib/ai/llm/runtime-config-provider";
import type { InvokeLlmOutput, LlmFinishReason } from "@/lib/ai/llm/types";
import { Output } from "ai";
import { z } from "zod";

const OPPORTUNITY_PROMPT_VERSION = "runtime-opportunities-v2";

const OpportunityScoreSchema = z.object({
  opportunityKey: z.string(),
  probability: z.number().min(0).max(100),
  contentMode: z.string(),
});

const OpportunityProbabilityOutputSchema = z.object({
  scores: z.array(OpportunityScoreSchema),
});

const SelectedSpeakerSchema = z.object({
  name: z.string(),
  probability: z.number().min(0).max(100),
});

const SpeakerCandidateEntrySchema = z.object({
  opportunityKey: z.string(),
  selectedSpeakers: z.array(SelectedSpeakerSchema),
});

const SpeakerCandidatesOutputSchema = z.object({
  speakerCandidates: z.array(SpeakerCandidateEntrySchema),
});
const OPPORTUNITY_OUTPUT_MAX_TOKENS = 900;
const CANDIDATE_OUTPUT_MAX_TOKENS = 900;
const AUDIT_OUTPUT_MAX_TOKENS = 400;
const REPAIR_OUTPUT_MAX_TOKENS = 900;
const MAX_STAGE_BATCH_SIZE = 10;
const MAX_PUBLIC_OPPORTUNITIES_PER_RUN = 100;
const MAX_STAGE_PROVIDER_RETRIES = 2;

type StageName = "opportunities" | "candidates";
type StagePhase = "main" | "schema_repair" | "quality_audit" | "quality_repair";

const JsonAuditResultSchema = z.object({
  pass: z.boolean(),
  issues: z.array(z.string()),
  repairInstructions: z.array(z.string()),
});

type JsonAuditResult = z.infer<typeof JsonAuditResultSchema>;

type OpportunityProbabilityOutput = {
  scores: Array<{
    opportunityKey: string;
    probability: number;
    contentMode: string;
  }>;
};

type SpeakerCandidatesOutput = {
  speakerCandidates: Array<{
    opportunityKey: string;
    selectedSpeakers: Array<{
      name: string;
      probability: number;
    }>;
  }>;
};

type StageInvokeInput = {
  stageName: StageName;
  phase: StagePhase;
  prompt: string;
  maxOutputTokens: number;
  temperature: number;
  entityId: string;
  output?: ReturnType<typeof Output.object>;
};

export type CandidateSelectionResult = {
  oppId: string;
  selectedSpeakers: Array<{ name: string; probability: number }>;
};

type StageRunResult<T> = {
  parsed: T;
  modelKey: string | null;
};

type OpportunityProbabilityValidation = {
  fatalIssues: string[];
  missingKeys: string[];
};

type SpeakerCandidateValidation = {
  fatalIssues: string[];
  missingOpportunityKeys: string[];
};

type IntakeStageLlmServiceDeps = {
  invokeStage: (input: StageInvokeInput) => Promise<InvokeLlmOutput>;
  now: () => Date;
};

class IntakeStageParseError extends Error {
  public readonly rawOutput: string;

  public constructor(message: string, rawOutput: string) {
    super(message);
    this.name = "IntakeStageParseError";
    this.rawOutput = rawOutput;
  }
}

function extractJsonFromText(rawText: string): string {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return "";
  }

  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    return trimmed;
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]+?)```/iu);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  return "";
}

function parseJsonObject(rawText: string): Record<string, unknown> {
  const jsonText = extractJsonFromText(rawText);
  if (!jsonText) {
    throw new IntakeStageParseError("stage returned empty output", rawText);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new IntakeStageParseError("stage returned invalid JSON", rawText);
  }

  const record = asRecord(parsed);
  if (!record) {
    throw new IntakeStageParseError("stage must return a JSON object", rawText);
  }

  return record;
}

function readExactKeys(record: Record<string, unknown>, allowed: string[], rawText: string) {
  const keys = Object.keys(record).sort();
  const expected = [...allowed].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw new IntakeStageParseError(
      `stage must return exactly these top-level keys: ${expected.join(", ")}`,
      rawText,
    );
  }
}

function parseOpportunityProbabilityOutput(rawText: string): OpportunityProbabilityOutput {
  const record = parseJsonObject(rawText);
  readExactKeys(record, ["scores"], rawText);
  const rows = record.scores;
  if (!Array.isArray(rows)) {
    throw new IntakeStageParseError("scores must be an array", rawText);
  }

  return {
    scores: rows.map((row) => {
      const item = asRecord(row);
      if (!item) {
        throw new IntakeStageParseError("scores rows must be objects", rawText);
      }
      readExactKeys(item, ["opportunity_key", "probability"], rawText);
      const opportunityKey = readString(item.opportunity_key).trim();
      const probability = readNumberOrNull(item.probability);
      if (!opportunityKey) {
        throw new IntakeStageParseError("opportunity_key must be a non-empty string", rawText);
      }
      if (probability === null || probability < 0 || probability > 1) {
        throw new IntakeStageParseError("probability must be a number between 0 and 1", rawText);
      }
      return {
        opportunityKey,
        probability: Number(probability.toFixed(2)),
        contentMode: "discussion",
      };
    }),
  };
}

function parseSpeakerCandidatesOutput(rawText: string): SpeakerCandidatesOutput {
  const record = parseJsonObject(rawText);
  readExactKeys(record, ["speaker_candidates"], rawText);
  const rows = record.speaker_candidates;
  if (!Array.isArray(rows)) {
    throw new IntakeStageParseError("speaker_candidates must be an array", rawText);
  }

  return {
    speakerCandidates: rows.map((row) => {
      const item = asRecord(row);
      if (!item) {
        throw new IntakeStageParseError("speaker_candidates rows must be objects", rawText);
      }
      readExactKeys(item, ["opportunity_key", "selected_speakers"], rawText);
      const opportunityKey = readString(item.opportunity_key).trim();
      if (!opportunityKey) {
        throw new IntakeStageParseError("opportunity_key must be a non-empty string", rawText);
      }
      if (!Array.isArray(item.selected_speakers)) {
        throw new IntakeStageParseError("selected_speakers must be an array", rawText);
      }
      return {
        opportunityKey,
        selectedSpeakers: item.selected_speakers.map((speaker) => {
          const speakerRecord = asRecord(speaker);
          if (!speakerRecord) {
            throw new IntakeStageParseError("selected_speakers rows must be objects", rawText);
          }
          readExactKeys(speakerRecord, ["name", "probability"], rawText);
          const name = readString(speakerRecord.name).trim();
          const probability = readNumberOrNull(speakerRecord.probability);
          if (!name) {
            throw new IntakeStageParseError("speaker name must be a non-empty string", rawText);
          }
          if (probability === null || probability < 0 || probability > 1) {
            throw new IntakeStageParseError(
              "speaker probability must be a number between 0 and 1",
              rawText,
            );
          }
          return {
            name,
            probability: Number(probability.toFixed(2)),
          };
        }),
      };
    }),
  };
}

function parseAuditResult(rawText: string): JsonAuditResult {
  const record = parseJsonObject(rawText);
  readExactKeys(record, ["issues", "pass", "repair_instructions"], rawText);
  if (!Array.isArray(record.issues) || !Array.isArray(record.repair_instructions)) {
    throw new IntakeStageParseError(
      "audit output must include issues and repair_instructions arrays",
      rawText,
    );
  }

  return {
    pass: readBoolean(record.pass),
    issues: record.issues
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0),
    repairInstructions: record.repair_instructions
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0),
  };
}

function inferOpportunitySource(row: AiOppRow): string {
  if (row.kind === "notification") {
    return "notification";
  }
  return row.source_table === "posts" ? "public-post" : "public-comment";
}

function buildOpportunityPromptInput(kind: AiOppRow["kind"], rows: AiOppRow[]) {
  return buildSelectorInputPreview({
    fixtureMode: kind === "notification" ? "notification-intake" : "mixed-public-opportunity",
    groupIndexOverride: 0,
    selectorReferenceBatchSize: 0,
    items: rows.map((row) => ({
      source: inferOpportunitySource(row),
      contentType: row.content_type,
      summary: row.summary,
      sourceId: row.source_id,
      createdAt: row.source_created_at ?? undefined,
      metadata: {
        boardId: row.board_id,
        boardSlug: row.board_slug,
        postId: row.post_id,
        commentId: row.comment_id,
      },
    })),
  });
}

function chunkArray<T>(rows: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize));
  }
  return chunks;
}

function validateOpportunityProbabilities(
  parsed: OpportunityProbabilityOutput,
  expectedKeys: string[],
): OpportunityProbabilityValidation {
  const fatalIssues: string[] = [];
  const missingKeys: string[] = [];
  const seen = new Set<string>();
  for (const row of parsed.scores) {
    if (seen.has(row.opportunityKey)) {
      fatalIssues.push(`Duplicate opportunity_key: ${row.opportunityKey}`);
    }
    seen.add(row.opportunityKey);
  }

  for (const key of expectedKeys) {
    if (!seen.has(key)) {
      missingKeys.push(key);
    }
  }

  for (const key of seen) {
    if (!expectedKeys.includes(key)) {
      fatalIssues.push(`Unknown opportunity_key: ${key}`);
    }
  }

  return {
    fatalIssues,
    missingKeys,
  };
}

function validateSpeakerCandidates(
  parsed: SpeakerCandidatesOutput,
  expectedOpportunityKeys: string[],
  referenceBatch: string[],
): SpeakerCandidateValidation {
  const fatalIssues: string[] = [];
  const seenOpportunityKeys = new Set<string>();
  const allowedNames = new Set(referenceBatch);
  const missingOpportunityKeys: string[] = [];

  for (const row of parsed.speakerCandidates) {
    if (seenOpportunityKeys.has(row.opportunityKey)) {
      fatalIssues.push(`Duplicate opportunity_key: ${row.opportunityKey}`);
    }
    seenOpportunityKeys.add(row.opportunityKey);
    if (row.selectedSpeakers.length < 1 || row.selectedSpeakers.length > 3) {
      fatalIssues.push(`${row.opportunityKey} must include between 1 and 3 selected_speakers.`);
    }

    const seenNames = new Set<string>();
    for (const speaker of row.selectedSpeakers) {
      if (!allowedNames.has(speaker.name)) {
        fatalIssues.push(`${row.opportunityKey} selected unknown speaker: ${speaker.name}`);
      }
      if (seenNames.has(speaker.name)) {
        fatalIssues.push(`${row.opportunityKey} selected duplicate speaker: ${speaker.name}`);
      }
      seenNames.add(speaker.name);
    }
  }

  for (const key of expectedOpportunityKeys) {
    if (!seenOpportunityKeys.has(key)) {
      missingOpportunityKeys.push(key);
    }
  }

  for (const key of seenOpportunityKeys) {
    if (!expectedOpportunityKeys.includes(key)) {
      fatalIssues.push(`Unknown opportunity_key: ${key}`);
    }
  }

  return {
    fatalIssues,
    missingOpportunityKeys,
  };
}

function buildQualityAuditPrompt(input: {
  stageName: StageName;
  contextLabel: string;
  contextContent: string;
  parsedOutput: Record<string, unknown>;
}) {
  return [
    `[stage_audit:${input.stageName}]`,
    "Audit the parsed JSON for semantic quality.",
    "Return exactly one JSON object.",
    "Return raw JSON only.",
    "pass: boolean",
    "issues: string[]",
    "repair_instructions: string[]",
    "If the parsed output is already strong and usable, set pass=true and return empty arrays.",
    "Keep every issue and repair instruction short and concrete.",
    "",
    `[${input.contextLabel}]`,
    input.contextContent,
    "",
    "[parsed_output]",
    JSON.stringify(input.parsedOutput, null, 2),
  ].join("\n");
}

function buildQualityRepairPrompt<T>(input: {
  basePrompt: string;
  stageName: StageName;
  parsedOutput: T;
  issues: string[];
  repairInstructions: string[];
}) {
  return [
    input.basePrompt,
    "",
    "[quality_repair]",
    `The previous ${input.stageName} JSON was parseable but failed deterministic checks or semantic audit.`,
    "Rewrite the full JSON from scratch using the same exact schema.",
    "Do not add commentary, markdown, or extra keys.",
    "",
    "Issues:",
    ...input.issues.map((issue) => `- ${issue}`),
    ...(input.repairInstructions.length > 0
      ? ["", "Repair instructions:", ...input.repairInstructions.map((item) => `- ${item}`)]
      : []),
    "",
    "[previous_parsed_output]",
    JSON.stringify(input.parsedOutput, null, 2),
  ].join("\n");
}

function buildModelKey(result: InvokeLlmOutput | null): string | null {
  if (!result?.providerId || !result?.modelId) {
    return null;
  }
  return `${result.providerId}:${result.modelId}`;
}

function clampNonNegativeInt(value: number, max: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.min(max, Math.floor(value));
}

// ---- Schema gate metadata for intake stages ----

function resolveIntakeSchemaGate(input: StageInvokeInput): {
  schemaName: string;
  schema: z.ZodTypeAny;
  validationRules: string[];
  allowedRepairPaths: string[];
  immutablePaths: string[];
} | null {
  if (!input.output) return null;

  // Audit phases use the audit schema regardless of stageName
  if (input.phase === "quality_audit") {
    return {
      schemaName: "JsonAuditResultSchema",
      schema: JsonAuditResultSchema,
      validationRules: [
        "pass must be boolean",
        "issues must be array of strings",
        "repairInstructions must be array of strings",
      ],
      allowedRepairPaths: ["pass", "issues", "repairInstructions"],
      immutablePaths: [],
    };
  }

  if (input.stageName === "opportunities") {
    return {
      schemaName: "OpportunityProbabilityOutputSchema",
      schema: OpportunityProbabilityOutputSchema,
      validationRules: [
        "scores must be array",
        "each score must have opportunityKey (string), probability (0-100), contentMode (string)",
      ],
      allowedRepairPaths: ["scores", "scores.*.probability", "scores.*.contentMode"],
      immutablePaths: ["scores.*.opportunityKey"],
    };
  }

  if (input.stageName === "candidates") {
    return {
      schemaName: "SpeakerCandidatesOutputSchema",
      schema: SpeakerCandidatesOutputSchema,
      validationRules: [
        "speakerCandidates must be array",
        "each entry must have opportunityKey (string), selectedSpeakers (array of {name, probability})",
      ],
      allowedRepairPaths: [
        "speakerCandidates",
        "speakerCandidates.*.selectedSpeakers",
        "speakerCandidates.*.selectedSpeakers.*.probability",
      ],
      immutablePaths: [
        "speakerCandidates.*.opportunityKey",
        "speakerCandidates.*.selectedSpeakers.*.name",
      ],
    };
  }

  return null;
}

export class AiAgentIntakeStageLlmService {
  private readonly deps: IntakeStageLlmServiceDeps;

  public constructor(options?: { deps?: Partial<IntakeStageLlmServiceDeps> }) {
    this.deps = {
      invokeStage:
        options?.deps?.invokeStage ??
        (async (input) => {
          const [registry, invocationConfig] = await Promise.all([
            createDbBackedLlmProviderRegistry({
              includeMock: true,
              includeXai: true,
              includeDeepSeek: true,
            }),
            resolveLlmInvocationConfig({
              taskType: "generic",
              capability: "text_generation",
              promptModality: "text_only",
            }),
          ]);

          const structuredMeta = resolveIntakeSchemaGate(input);

          // Route through invokeStructuredLLM when we have an output schema
          if (structuredMeta) {
            const result = await invokeStructuredLLM({
              registry,
              taskType: "generic",
              routeOverride: invocationConfig.route,
              modelInput: {
                prompt: input.prompt,
                maxOutputTokens: input.maxOutputTokens,
                temperature: input.temperature,
                metadata: {
                  _m: {
                    stageName: input.stageName,
                    phase: input.phase,
                  },
                },
              },
              entityId: input.entityId,
              timeoutMs: invocationConfig.timeoutMs,
              retries: clampNonNegativeInt(
                invocationConfig.retries ?? 0,
                MAX_STAGE_PROVIDER_RETRIES,
              ),
              schemaGate: {
                schemaName: structuredMeta.schemaName,
                schema: structuredMeta.schema,
                validationRules: structuredMeta.validationRules,
                allowedRepairPaths: structuredMeta.allowedRepairPaths,
                immutablePaths: structuredMeta.immutablePaths,
              },
            });

            return {
              text: result.raw.text,
              finishReason: (result.raw.finishReason ?? "stop") as LlmFinishReason,
              providerId: result.raw.providerId,
              modelId: result.raw.modelId,
              usage: result.raw.usage,
              error: result.status === "schema_failure" ? result.error : result.raw.error,
              errorDetails: result.raw.errorDetails,
              object: result.status === "valid" ? result.value : undefined,
              usedFallback: result.raw.usedFallback,
              attempts: result.raw.attempts,
              path: result.raw.path,
            };
          }

          // No structured output — use raw invokeLLM
          return invokeLLM({
            registry,
            taskType: "generic",
            routeOverride: invocationConfig.route,
            modelInput: {
              prompt: input.prompt,
              maxOutputTokens: input.maxOutputTokens,
              temperature: input.temperature,
              metadata: {
                _m: {
                  stageName: input.stageName,
                  phase: input.phase,
                },
              },
              ...(input.output ? { output: input.output } : {}),
            },
            entityId: input.entityId,
            timeoutMs: invocationConfig.timeoutMs,
            retries: clampNonNegativeInt(invocationConfig.retries ?? 0, MAX_STAGE_PROVIDER_RETRIES),
          });
        }),
      now: options?.deps?.now ?? (() => new Date()),
    };
  }

  private async runJsonStage<T>(input: {
    stageName: StageName;
    basePrompt: string;
    parse: (rawText: string) => T;
    validateDeterministic: (parsed: T) => string[];
    buildAuditContext: () => { label: string; content: string };
  }): Promise<StageRunResult<T>> {
    const mainResult = await this.deps.invokeStage({
      stageName: input.stageName,
      phase: "main",
      prompt: input.basePrompt,
      maxOutputTokens:
        input.stageName === "opportunities"
          ? OPPORTUNITY_OUTPUT_MAX_TOKENS
          : CANDIDATE_OUTPUT_MAX_TOKENS,
      temperature: 0.2,
      entityId: `ai-agent-intake:${input.stageName}:main`,
      output:
        input.stageName === "opportunities"
          ? Output.object({ schema: OpportunityProbabilityOutputSchema })
          : Output.object({ schema: SpeakerCandidatesOutputSchema }),
    });

    if (mainResult.finishReason === "error") {
      throw new Error(
        `${input.stageName} stage provider failed: ${mainResult.error ?? "unknown provider error"}`,
      );
    }

    // attemptParse: prefer structured output, fall back to text parse
    let parsed: T;
    let parsedFrom = mainResult;
    if (mainResult.object) {
      parsed = mainResult.object as T;
    } else {
      try {
        parsed = input.parse(mainResult.text);
      } catch (error) {
        const message = error instanceof Error ? error.message : "stage parsing failed";
        throw new IntakeStageParseError(message, mainResult.text);
      }
    }

    // Deterministic + semantic quality check
    const deterministicIssues = input.validateDeterministic(parsed);
    let audit = await this.runQualityAudit({
      stageName: input.stageName,
      parsedOutput: parsed,
      ...input.buildAuditContext(),
    });

    if (deterministicIssues.length === 0 && audit.pass) {
      return {
        parsed,
        modelKey: buildModelKey(parsedFrom),
      };
    }

    // Quality repair: delta-based (matching persona generation pattern)
    for (const attempt of [1, 2] as const) {
      const repairResult = await this.deps.invokeStage({
        stageName: input.stageName,
        phase: "quality_repair",
        prompt: buildQualityRepairPrompt({
          basePrompt: input.basePrompt,
          stageName: input.stageName,
          parsedOutput: parsed,
          issues: [...deterministicIssues, ...audit.issues],
          repairInstructions: audit.repairInstructions,
        }),
        maxOutputTokens: REPAIR_OUTPUT_MAX_TOKENS,
        temperature: 0.1,
        entityId: `ai-agent-intake:${input.stageName}:quality-repair:${attempt}`,
        output:
          input.stageName === "opportunities"
            ? Output.object({ schema: OpportunityProbabilityOutputSchema })
            : Output.object({ schema: SpeakerCandidatesOutputSchema }),
      });

      if (repairResult.object) {
        parsed = repairResult.object as T;
      } else {
        try {
          parsed = input.parse(repairResult.text);
        } catch {
          if (attempt === 2) break;
          continue;
        }
      }
      parsedFrom = repairResult;

      const newIssues = input.validateDeterministic(parsed);
      audit = await this.runQualityAudit({
        stageName: input.stageName,
        parsedOutput: parsed,
        ...input.buildAuditContext(),
      });

      if (newIssues.length === 0 && audit.pass) {
        return {
          parsed,
          modelKey: buildModelKey(parsedFrom),
        };
      }
    }

    throw new Error(
      `${input.stageName} stage failed validation after repair limit: ${[
        ...input.validateDeterministic(parsed),
        ...audit.issues,
      ].join("; ")}`,
    );
  }

  private async runQualityAudit(input: {
    stageName: StageName;
    label: string;
    content: string;
    parsedOutput: unknown;
  }): Promise<JsonAuditResult> {
    const auditResult = await this.deps.invokeStage({
      stageName: input.stageName,
      phase: "quality_audit",
      prompt: buildQualityAuditPrompt({
        stageName: input.stageName,
        contextLabel: input.label,
        contextContent: input.content,
        parsedOutput: input.parsedOutput as Record<string, unknown>,
      }),
      maxOutputTokens: AUDIT_OUTPUT_MAX_TOKENS,
      temperature: 0,
      entityId: `ai-agent-intake:${input.stageName}:quality-audit`,
      output: Output.object({ schema: JsonAuditResultSchema }),
    });

    if (auditResult.object) {
      return auditResult.object as JsonAuditResult;
    }

    try {
      return parseAuditResult(auditResult.text);
    } catch {
      return {
        pass: false,
        issues: [`${input.stageName} audit returned invalid JSON.`],
        repairInstructions: [],
      };
    }
  }

  public async scoreOpportunities(input: {
    kind: AiOppRow["kind"];
    rows: AiOppRow[];
  }): Promise<AiOppProbabilityUpdateInput[]> {
    const scopedRows =
      input.kind === "public" ? input.rows.slice(0, MAX_PUBLIC_OPPORTUNITIES_PER_RUN) : input.rows;
    if (scopedRows.length === 0) return [];

    const evaluatedAt = this.deps.now().toISOString();
    const results: AiOppProbabilityUpdateInput[] = [];

    for (const rows of chunkArray(scopedRows, MAX_STAGE_BATCH_SIZE)) {
      const selectorInput = buildOpportunityPromptInput(input.kind, rows);
      const keyToOppId = new Map(
        selectorInput.opportunities.map((row, index) => [
          row.opportunityKey,
          rows[index]?.id ?? "",
        ]),
      );

      const stage = await this.runJsonStage({
        stageName: "opportunities",
        basePrompt: buildOpportunityStagePrompt(selectorInput),
        parse: parseOpportunityProbabilityOutput,
        validateDeterministic: (parsed) =>
          validateOpportunityProbabilities(
            parsed,
            selectorInput.opportunities.map((r) => r.opportunityKey),
          ).fatalIssues,
        buildAuditContext: () => ({
          label: "available_opportunities",
          content:
            selectorInput.opportunities
              .map((row) => `${row.opportunityKey}: ${row.contentType} / ${row.summary}`)
              .join("\n") || "(empty)",
        }),
      });

      for (const row of stage.parsed.scores) {
        results.push({
          opportunityId: keyToOppId.get(row.opportunityKey) ?? row.opportunityKey,
          probability: row.probability,
          probabilityModelKey: stage.modelKey,
          probabilityPromptVersion: OPPORTUNITY_PROMPT_VERSION,
          evaluatedAt,
        });
      }
    }

    return results;
  }

  public async selectPublicSpeakerCandidates(input: {
    rows: AiOppRow[];
    referenceBatch: string[];
    personaCards?: Array<{
      referenceName: string;
      abstractTraits: string[];
      participationMode: string;
      topForumIntents: string[];
    }>;
  }): Promise<CandidateSelectionResult[]> {
    if (input.rows.length === 0 || input.referenceBatch.length === 0) return [];

    const results: CandidateSelectionResult[] = [];

    for (const rows of chunkArray(input.rows, MAX_STAGE_BATCH_SIZE)) {
      const selectorInput = buildOpportunityPromptInput("public", rows);
      const selectedOpportunities = selectorInput.opportunities.map((row) => ({
        opportunityKey: row.opportunityKey,
        contentType: row.contentType,
        summary: row.summary,
      }));
      const keyToOppId = new Map(
        selectorInput.opportunities.map((row, index) => [
          row.opportunityKey,
          rows[index]?.id ?? "",
        ]),
      );

      const stage = await this.runJsonStage({
        stageName: "candidates",
        basePrompt: buildCandidateStagePrompt({
          selectedOpportunities,
          referenceBatch: input.referenceBatch,
          personaCards: input.personaCards,
        }),
        parse: parseSpeakerCandidatesOutput,
        validateDeterministic: (parsed) =>
          validateSpeakerCandidates(
            parsed,
            selectedOpportunities.map((r) => r.opportunityKey),
            input.referenceBatch,
          ).fatalIssues,
        buildAuditContext: () => ({
          label: "candidate_context",
          content: JSON.stringify(
            { selected_opportunities: selectedOpportunities, speaker_batch: input.referenceBatch },
            null,
            2,
          ),
        }),
      });

      for (const row of stage.parsed.speakerCandidates) {
        results.push({
          oppId: keyToOppId.get(row.opportunityKey) ?? row.opportunityKey,
          selectedSpeakers: row.selectedSpeakers,
        });
      }
    }

    return results;
  }
}
