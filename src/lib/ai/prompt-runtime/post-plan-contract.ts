export type PostPlanCandidate = {
  title: string;
  angleSummary: string;
  thesis: string;
  bodyOutline: string[];
  differenceFromRecent: string[];
  boardFitScore: number;
  titlePersonaFitScore: number;
  titleNoveltyScore: number;
  angleNoveltyScore: number;
  bodyUsefulnessScore: number;
  modelOwnedOverallScorePresent?: boolean;
};

export type PostPlanOutput = {
  candidates: PostPlanCandidate[];
};

export type ParsedPostPlanActionOutput = {
  output: PostPlanOutput | null;
  error: string | null;
};

export type PostPlanGateResult = {
  passedCandidateIndexes: number[];
  selectedCandidateIndex: number | null;
};

function normalizeText(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function extractJsonFromText(text: string): string {
  const trimmed = normalizeText(text);
  if (!trimmed) {
    return "";
  }
  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i) ?? trimmed.match(/```\s*([\s\S]*?)```/i);
  return fenced?.[1]?.trim() ?? trimmed;
}

function parseJsonObject(text: string): Record<string, unknown> {
  const jsonText = extractJsonFromText(text);
  if (!jsonText) {
    throw new Error("structured action output is empty");
  }
  const parsed = JSON.parse(jsonText) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("structured action output must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function readOptionalString(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return normalizeText(value);
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => readOptionalString(item)).filter((item) => item.length > 0);
}

function readScore(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : Number.NaN;
}

function normalizeTitleKey(value: string): string {
  return normalizeText(value).toLowerCase();
}

function isIntegerScore(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 100;
}

function candidateIssues(candidate: PostPlanCandidate, index: number): string[] {
  const issues: string[] = [];
  if (!candidate.title) {
    issues.push(`candidate ${index} title is required.`);
  }
  if (!candidate.angleSummary) {
    issues.push(`candidate ${index} angle_summary is required.`);
  }
  if (!candidate.thesis) {
    issues.push(`candidate ${index} thesis is required.`);
  }
  if (candidate.bodyOutline.length < 3 || candidate.bodyOutline.length > 5) {
    issues.push(`candidate ${index} body_outline must contain 3 to 5 items.`);
  }
  if (candidate.differenceFromRecent.length < 1 || candidate.differenceFromRecent.length > 3) {
    issues.push(`candidate ${index} difference_from_recent must contain 1 to 3 items.`);
  }
  if (candidate.modelOwnedOverallScorePresent) {
    issues.push(`candidate ${index} must not include model-owned overall_score.`);
  }

  const scoreFields = [
    ["board_fit_score", candidate.boardFitScore],
    ["title_persona_fit_score", candidate.titlePersonaFitScore],
    ["title_novelty_score", candidate.titleNoveltyScore],
    ["angle_novelty_score", candidate.angleNoveltyScore],
    ["body_usefulness_score", candidate.bodyUsefulnessScore],
  ] as const;
  for (const [fieldName, value] of scoreFields) {
    if (!isIntegerScore(value)) {
      issues.push(`candidate ${index} ${fieldName} must be an integer from 0 to 100.`);
    }
  }

  return issues;
}

export function parsePostPlanActionOutput(rawText: string): ParsedPostPlanActionOutput {
  const normalized = normalizeText(rawText);
  if (!normalized) {
    return {
      output: null,
      error: "invalid post_plan output: response is empty",
    };
  }

  try {
    const parsed = parseJsonObject(normalized);
    const candidates = Array.isArray(parsed.candidates) ? parsed.candidates : [];

    return {
      output: {
        candidates: candidates.map((candidate) => {
          const record =
            candidate && typeof candidate === "object" && !Array.isArray(candidate)
              ? (candidate as Record<string, unknown>)
              : {};
          return {
            title: readOptionalString(record.title),
            angleSummary: readOptionalString(record.angle_summary),
            thesis: readOptionalString(record.thesis),
            bodyOutline: readStringArray(record.body_outline),
            differenceFromRecent: readStringArray(record.difference_from_recent),
            boardFitScore: readScore(record.board_fit_score),
            titlePersonaFitScore: readScore(record.title_persona_fit_score),
            titleNoveltyScore: readScore(record.title_novelty_score),
            angleNoveltyScore: readScore(record.angle_novelty_score),
            bodyUsefulnessScore: readScore(record.body_usefulness_score),
            modelOwnedOverallScorePresent: Object.prototype.hasOwnProperty.call(
              record,
              "overall_score",
            ),
          };
        }),
      },
      error: null,
    };
  } catch {
    return {
      output: null,
      error: "invalid post_plan output: expected one JSON object with candidates",
    };
  }
}

export function validatePostPlanOutput(output: PostPlanOutput): string[] {
  const issues: string[] = [];

  if (output.candidates.length !== 3) {
    issues.push("post_plan must return exactly 3 candidates.");
  }

  const seenTitles = new Set<string>();
  output.candidates.forEach((candidate, index) => {
    issues.push(...candidateIssues(candidate, index));
    const titleKey = normalizeTitleKey(candidate.title);
    if (!titleKey) {
      return;
    }
    if (seenTitles.has(titleKey)) {
      issues.push(
        `candidate titles must be unique after normalization; duplicate title "${candidate.title}".`,
      );
      return;
    }
    seenTitles.add(titleKey);
  });

  return issues;
}

export function computePostPlanOverallScore(candidate: PostPlanCandidate): number {
  return (
    candidate.boardFitScore * 0.2 +
    candidate.titlePersonaFitScore * 0.15 +
    candidate.titleNoveltyScore * 0.2 +
    candidate.angleNoveltyScore * 0.3 +
    candidate.bodyUsefulnessScore * 0.15
  );
}

function doesCandidatePassGate(candidate: PostPlanCandidate): boolean {
  return (
    candidate.boardFitScore >= 70 &&
    candidate.titlePersonaFitScore >= 70 &&
    candidate.titleNoveltyScore >= 75 &&
    candidate.angleNoveltyScore >= 80 &&
    candidate.bodyUsefulnessScore >= 70 &&
    computePostPlanOverallScore(candidate) >= 80
  );
}

export function evaluatePostPlanGate(output: PostPlanOutput): PostPlanGateResult {
  const deterministicIssues = validatePostPlanOutput(output);
  if (deterministicIssues.length > 0) {
    return {
      passedCandidateIndexes: [],
      selectedCandidateIndex: null,
    };
  }

  const ranked = output.candidates
    .map((candidate, index) => ({
      index,
      overallScore: computePostPlanOverallScore(candidate),
      passes: doesCandidatePassGate(candidate),
    }))
    .filter((item) => item.passes)
    .sort((left, right) => right.overallScore - left.overallScore || left.index - right.index);

  return {
    passedCandidateIndexes: ranked.map((item) => item.index).sort((left, right) => left - right),
    selectedCandidateIndex: ranked[0]?.index ?? null,
  };
}
