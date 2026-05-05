import { normalizeText, parseJsonObject, readStringArray } from "./json-parse-utils";

export type PostPlanCandidate = {
  title: string;
  thesis: string;
  bodyOutline: string[];
  personaFitScore: number;
  noveltyScore: number;
};

export type PostPlanOutput = {
  candidates: PostPlanCandidate[];
};

export type ParsedPostPlanActionOutput = {
  output: PostPlanOutput | null;
  error: string | null;
};

export type PostPlanGateResult = {
  selectedCandidateIndex: number | null;
};

function readOptionalString(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return normalizeText(value);
}

function readStringArrayOrEmpty(value: unknown): string[] {
  return readStringArray(value) ?? [];
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
  if (!candidate.thesis) {
    issues.push(`candidate ${index} thesis is required.`);
  }
  if (candidate.bodyOutline.length < 2 || candidate.bodyOutline.length > 5) {
    issues.push(`candidate ${index} body_outline must contain 2 to 5 items.`);
  }

  const scoreFields = [
    ["persona_fit_score", candidate.personaFitScore],
    ["novelty_score", candidate.noveltyScore],
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
    const parsed = parseJsonObject(normalized, (type) => {
      if (type === "empty") {
        return new Error("structured action output is empty");
      }
      if (type === "invalid_json") {
        return new Error("structured action output is invalid JSON");
      }
      return new Error("structured action output must be a JSON object");
    });
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
            thesis: readOptionalString(record.thesis),
            bodyOutline: readStringArrayOrEmpty(record.body_outline),
            personaFitScore: readScore(record.persona_fit_score),
            noveltyScore: readScore(record.novelty_score),
          };
        }),
      },
      error: null,
    };
  } catch (parseError) {
    const detail =
      parseError instanceof Error ? parseError.message : "expected one JSON object with candidates";
    return {
      output: null,
      error: `invalid post_plan output: ${detail}`,
    };
  }
}

export function validatePostPlanOutput(output: PostPlanOutput): string[] {
  const issues: string[] = [];

  if (output.candidates.length < 2) {
    issues.push("post_plan must return at least 2 candidates.");
  }
  if (output.candidates.length > 3) {
    issues.push("post_plan must return at most 3 candidates.");
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
  return candidate.personaFitScore * 0.6 + candidate.noveltyScore * 0.4;
}

export function pickBestCandidate(output: PostPlanOutput): PostPlanGateResult {
  if (output.candidates.length === 0) {
    return { selectedCandidateIndex: null };
  }

  const ranked = output.candidates
    .map((candidate, index) => ({
      index,
      overallScore: computePostPlanOverallScore(candidate),
    }))
    .sort((left, right) => right.overallScore - left.overallScore || left.index - right.index);

  return {
    selectedCandidateIndex: ranked[0].index,
  };
}
