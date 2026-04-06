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
  type SelectorInputPreview,
} from "@/lib/ai/agent/intake/intake-preview";
import type {
  AiOppProbabilityUpdateInput,
  AiOppRow,
} from "@/lib/ai/agent/intake/opportunity-store";
import { createDbBackedLlmProviderRegistry } from "@/lib/ai/llm/default-registry";
import { invokeLLM } from "@/lib/ai/llm/invoke-llm";
import { resolveLlmInvocationConfig } from "@/lib/ai/llm/runtime-config-provider";
import type { InvokeLlmOutput } from "@/lib/ai/llm/types";

const OPPORTUNITY_PROMPT_VERSION = "runtime-opportunities-v2";
const CANDIDATE_PROMPT_VERSION = "runtime-candidates-v2";
const OPPORTUNITY_OUTPUT_MAX_TOKENS = 900;
const CANDIDATE_OUTPUT_MAX_TOKENS = 900;
const AUDIT_OUTPUT_MAX_TOKENS = 400;
const REPAIR_OUTPUT_MAX_TOKENS = 900;
const MAX_STAGE_BATCH_SIZE = 10;
const MAX_PUBLIC_OPPORTUNITIES_PER_RUN = 100;
const MAX_STAGE_PROVIDER_RETRIES = 2;
const MAX_SCHEMA_REPAIR_ATTEMPTS = 1;
const MAX_QUALITY_REPAIR_ATTEMPTS = 1;
const MAX_SUBSET_REPAIR_ATTEMPTS = 1;

type StageName = "opportunities" | "candidates";
type StagePhase = "main" | "schema_repair" | "quality_audit" | "quality_repair";

type JsonAuditResult = {
  pass: boolean;
  issues: string[];
  repairInstructions: string[];
};

type OpportunityProbabilityOutput = {
  opportunityProbabilities: Array<{
    opportunityKey: string;
    probability: number;
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
    opportunityProbabilities: rows.map((row) => {
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
  for (const row of parsed.opportunityProbabilities) {
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

function buildSchemaRepairPrompt(input: {
  basePrompt: string;
  stageName: StageName;
  errorMessage: string;
  rawOutput: string;
}) {
  return [
    input.basePrompt,
    "",
    "[retry_repair]",
    `Your previous ${input.stageName} response was invalid JSON or failed schema validation.`,
    `Repair target: ${input.errorMessage}`,
    "Rewrite the full response from scratch as one complete valid JSON object using the same exact schema.",
    "Do not add commentary, markdown, or extra keys.",
    "",
    "[previous_output]",
    input.rawOutput.trim() || "(empty)",
  ].join("\n");
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
              includeMinimax: true,
            }),
            resolveLlmInvocationConfig({
              taskType: "generic",
              capability: "text_generation",
              promptModality: "text_only",
            }),
          ]);

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
    });

    let parsedFrom = mainResult;
    let parsed: T | null = null;
    let lastParseError: IntakeStageParseError | null = null;
    let currentRawOutput = mainResult.text;

    for (let attempt = 0; attempt <= MAX_SCHEMA_REPAIR_ATTEMPTS; attempt += 1) {
      try {
        parsed = input.parse(currentRawOutput);
        lastParseError = null;
        break;
      } catch (error) {
        const parseError =
          error instanceof IntakeStageParseError
            ? error
            : new IntakeStageParseError(
                error instanceof Error ? error.message : "stage parsing failed",
                currentRawOutput,
              );
        lastParseError = parseError;
        if (attempt >= MAX_SCHEMA_REPAIR_ATTEMPTS) {
          break;
        }
        const repairResult = await this.deps.invokeStage({
          stageName: input.stageName,
          phase: "schema_repair",
          prompt: buildSchemaRepairPrompt({
            basePrompt: input.basePrompt,
            stageName: input.stageName,
            errorMessage: parseError.message,
            rawOutput: parseError.rawOutput,
          }),
          maxOutputTokens: REPAIR_OUTPUT_MAX_TOKENS,
          temperature: 0.1,
          entityId: `ai-agent-intake:${input.stageName}:schema-repair:${attempt + 1}`,
        });
        currentRawOutput = repairResult.text;
        parsedFrom = repairResult;
      }
    }

    if (!parsed) {
      throw lastParseError ?? new Error(`${input.stageName} stage parsing failed`);
    }

    let deterministicIssues = input.validateDeterministic(parsed);
    let audit = await this.runQualityAudit({
      stageName: input.stageName,
      parsedOutput: parsed,
      ...input.buildAuditContext(),
    });

    for (let attempt = 0; attempt <= MAX_QUALITY_REPAIR_ATTEMPTS; attempt += 1) {
      if (deterministicIssues.length === 0 && audit.pass) {
        return {
          parsed,
          modelKey: buildModelKey(parsedFrom),
        };
      }

      if (attempt >= MAX_QUALITY_REPAIR_ATTEMPTS) {
        break;
      }

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
        entityId: `ai-agent-intake:${input.stageName}:quality-repair:${attempt + 1}`,
      });

      parsed = input.parse(repairResult.text);
      parsedFrom = repairResult;
      deterministicIssues = input.validateDeterministic(parsed);
      audit = await this.runQualityAudit({
        stageName: input.stageName,
        parsedOutput: parsed,
        ...input.buildAuditContext(),
      });
    }

    throw new Error(
      `${input.stageName} stage failed validation after repair limit: ${[
        ...deterministicIssues,
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
    });

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
    if (scopedRows.length === 0) {
      return [];
    }

    const evaluatedAt = this.deps.now().toISOString();
    const batchResults: Array<
      StageRunResult<OpportunityProbabilityOutput> & {
        keyToOppId: Map<string, string>;
      }
    > = [];
    for (const rows of chunkArray(scopedRows, MAX_STAGE_BATCH_SIZE)) {
      batchResults.push(
        await this.scoreOpportunityBatch({
          kind: input.kind,
          rows,
          subsetRetryBudget: MAX_SUBSET_REPAIR_ATTEMPTS,
        }),
      );
    }

    return batchResults.flatMap((batch) =>
      batch.parsed.opportunityProbabilities.map((row) => ({
        opportunityId: batch.keyToOppId.get(row.opportunityKey) ?? row.opportunityKey,
        probability: row.probability,
        probabilityModelKey: batch.modelKey,
        probabilityPromptVersion: OPPORTUNITY_PROMPT_VERSION,
        evaluatedAt,
      })),
    );
  }

  public async selectPublicSpeakerCandidates(input: {
    rows: AiOppRow[];
    referenceBatch: string[];
  }): Promise<CandidateSelectionResult[]> {
    if (input.rows.length === 0 || input.referenceBatch.length === 0) {
      return [];
    }

    const batchResults: Array<
      StageRunResult<SpeakerCandidatesOutput> & {
        keyToOppId: Map<string, string>;
      }
    > = [];
    for (const rows of chunkArray(input.rows, MAX_STAGE_BATCH_SIZE)) {
      batchResults.push(
        await this.selectPublicSpeakerCandidateBatch({
          rows,
          referenceBatch: input.referenceBatch,
          subsetRetryBudget: MAX_SUBSET_REPAIR_ATTEMPTS,
        }),
      );
    }

    return batchResults.flatMap((batch) =>
      batch.parsed.speakerCandidates.map((row) => ({
        oppId: batch.keyToOppId.get(row.opportunityKey) ?? row.opportunityKey,
        selectedSpeakers: row.selectedSpeakers,
      })),
    );
  }

  private async scoreOpportunityBatch(input: {
    kind: AiOppRow["kind"];
    rows: AiOppRow[];
    subsetRetryBudget: number;
  }): Promise<
    StageRunResult<OpportunityProbabilityOutput> & {
      keyToOppId: Map<string, string>;
    }
  > {
    const selectorInput = buildOpportunityPromptInput(input.kind, input.rows);
    const expectedKeys = selectorInput.opportunities.map((row) => row.opportunityKey);
    const keyToOppId = new Map(
      selectorInput.opportunities.map((row, index) => [
        row.opportunityKey,
        input.rows[index]?.id ?? "",
      ]),
    );

    const stage = await this.runJsonStage({
      stageName: "opportunities",
      basePrompt: buildOpportunityStagePrompt(selectorInput),
      parse: parseOpportunityProbabilityOutput,
      validateDeterministic: (parsed) =>
        validateOpportunityProbabilities(parsed, expectedKeys).fatalIssues,
      buildAuditContext: () => ({
        label: "available_opportunities",
        content:
          selectorInput.opportunities
            .map((row) => `${row.opportunityKey}: ${row.contentType} / ${row.summary}`)
            .join("\n") || "(empty)",
      }),
    });

    const validation = validateOpportunityProbabilities(stage.parsed, expectedKeys);
    if (validation.missingKeys.length === 0) {
      return { ...stage, keyToOppId };
    }
    if (input.subsetRetryBudget <= 0) {
      throw new Error(
        `opportunities stage still missing keys after subset retry: ${validation.missingKeys.join(", ")}`,
      );
    }

    const missingRows = expectedKeys
      .map((key, index) => ({ key, row: input.rows[index] }))
      .filter((entry) => validation.missingKeys.includes(entry.key))
      .map((entry) => entry.row)
      .filter((row): row is AiOppRow => Boolean(row));
    const missingResult = await this.scoreOpportunityBatch({
      kind: input.kind,
      rows: missingRows,
      subsetRetryBudget: input.subsetRetryBudget - 1,
    });

    const merged = new Map(
      stage.parsed.opportunityProbabilities.map((row) => [row.opportunityKey, row] as const),
    );
    const originalKeyByOppId = new Map(
      Array.from(keyToOppId.entries()).map(([key, oppId]) => [oppId, key] as const),
    );
    for (const row of missingResult.parsed.opportunityProbabilities) {
      const retryOppId = missingResult.keyToOppId.get(row.opportunityKey);
      const originalKey = retryOppId ? originalKeyByOppId.get(retryOppId) : null;
      if (originalKey) {
        merged.set(originalKey, {
          opportunityKey: originalKey,
          probability: row.probability,
        });
      }
    }

    return {
      parsed: {
        opportunityProbabilities: expectedKeys
          .map((key) => merged.get(key))
          .filter((row): row is { opportunityKey: string; probability: number } => Boolean(row)),
      },
      modelKey: stage.modelKey ?? missingResult.modelKey,
      keyToOppId,
    };
  }

  private async selectPublicSpeakerCandidateBatch(input: {
    rows: AiOppRow[];
    referenceBatch: string[];
    subsetRetryBudget: number;
  }): Promise<
    StageRunResult<SpeakerCandidatesOutput> & {
      keyToOppId: Map<string, string>;
    }
  > {
    const selectorInput = buildOpportunityPromptInput("public", input.rows);
    const selectedOpportunities = selectorInput.opportunities.map((row) => ({
      opportunityKey: row.opportunityKey,
      contentType: row.contentType,
      summary: row.summary,
    }));
    const expectedKeys = selectedOpportunities.map((row) => row.opportunityKey);
    const keyToOppId = new Map(
      selectorInput.opportunities.map((row, index) => [
        row.opportunityKey,
        input.rows[index]?.id ?? "",
      ]),
    );

    const stage = await this.runJsonStage({
      stageName: "candidates",
      basePrompt: buildCandidateStagePrompt({
        selectedOpportunities,
        referenceBatch: input.referenceBatch,
      }),
      parse: parseSpeakerCandidatesOutput,
      validateDeterministic: (parsed) =>
        validateSpeakerCandidates(parsed, expectedKeys, input.referenceBatch).fatalIssues,
      buildAuditContext: () => ({
        label: "candidate_context",
        content: JSON.stringify(
          {
            selected_opportunities: selectedOpportunities,
            speaker_batch: input.referenceBatch,
          },
          null,
          2,
        ),
      }),
    });

    const validation = validateSpeakerCandidates(stage.parsed, expectedKeys, input.referenceBatch);
    if (validation.missingOpportunityKeys.length === 0) {
      return { ...stage, keyToOppId };
    }
    if (input.subsetRetryBudget <= 0) {
      throw new Error(
        `candidates stage still missing opportunities after subset retry: ${validation.missingOpportunityKeys.join(", ")}`,
      );
    }

    const missingRows = expectedKeys
      .map((key, index) => ({ key, row: input.rows[index] }))
      .filter((entry) => validation.missingOpportunityKeys.includes(entry.key))
      .map((entry) => entry.row)
      .filter((row): row is AiOppRow => Boolean(row));
    const missingResult = await this.selectPublicSpeakerCandidateBatch({
      rows: missingRows,
      referenceBatch: input.referenceBatch,
      subsetRetryBudget: input.subsetRetryBudget - 1,
    });

    const merged = new Map(
      stage.parsed.speakerCandidates.map((row) => [row.opportunityKey, row] as const),
    );
    const originalKeyByOppId = new Map(
      Array.from(keyToOppId.entries()).map(([key, oppId]) => [oppId, key] as const),
    );
    for (const row of missingResult.parsed.speakerCandidates) {
      const retryOppId = missingResult.keyToOppId.get(row.opportunityKey);
      const originalKey = retryOppId ? originalKeyByOppId.get(retryOppId) : null;
      if (originalKey) {
        merged.set(originalKey, {
          opportunityKey: originalKey,
          selectedSpeakers: row.selectedSpeakers,
        });
      }
    }

    return {
      parsed: {
        speakerCandidates: expectedKeys
          .map((key) => merged.get(key))
          .filter(
            (
              row,
            ): row is {
              opportunityKey: string;
              selectedSpeakers: Array<{ name: string; probability: number }>;
            } => Boolean(row),
          ),
      },
      modelKey: stage.modelKey ?? missingResult.modelKey,
      keyToOppId,
    };
  }
}
