import type { BracketState, TruncationClassification } from "./schema-gate-contracts";

export function scanJsonState(rawText: string): BracketState {
  const stack: Array<"{" | "[" | '"' | "string"> = [];
  let openString = false;
  let lastKey: string | null = null;
  let lastPath: string | null = null;
  let depth = 0;

  let i = 0;
  while (i < rawText.length) {
    const ch = rawText[i];

    if (openString) {
      if (ch === "\\" && i + 1 < rawText.length) {
        i += 2;
        continue;
      }
      if (ch === '"') {
        openString = false;
        const top = stack[stack.length - 1];
        if (top === "string") {
          stack.pop();
        } else if (top === '"') {
          stack.pop();
          let j = i + 1;
          while (j < rawText.length && /\s/.test(rawText[j])) j++;
          if (j < rawText.length && rawText[j] === ":") {
            const keyStart = findKeyStart(rawText, i);
            lastKey = rawText.slice(keyStart, i).replace(/^"/, "").replace(/"$/, "");
            if (lastPath) {
              lastPath = `${lastPath}.${lastKey}`;
            } else {
              lastPath = lastKey;
            }
          }
        }
      }
      i++;
      continue;
    }

    switch (ch) {
      case '"':
        openString = true;
        const prev = getLastNonWhitespace(rawText, i);
        if (prev === "{" || prev === ",") {
          stack.push('"');
        } else if (prev === ":" || prev === "[" || prev === null) {
          stack.push("string");
        } else {
          stack.push("string");
        }
        break;
      case "{":
        stack.push("{");
        depth++;
        lastKey = null;
        break;
      case "[":
        stack.push("[");
        depth++;
        break;
      case "}":
        if (stack[stack.length - 1] === "{") {
          stack.pop();
          depth--;
          if (lastPath) {
            const dotIdx = lastPath.lastIndexOf(".");
            lastPath = dotIdx > -1 ? lastPath.slice(0, dotIdx) : null;
          }
          lastKey = null;
        }
        break;
      case "]":
        if (stack[stack.length - 1] === "[") {
          stack.pop();
          depth--;
        }
        break;
      case ":":
      case ",":
      default:
        break;
    }
    i++;
  }

  return { stack, openString, lastKey, lastPath, depth };
}

function getLastNonWhitespace(text: string, beforeIdx: number): string | null {
  for (let i = beforeIdx - 1; i >= 0; i--) {
    if (!/\s/.test(text[i])) {
      return text[i];
    }
  }
  return null;
}

function findKeyStart(text: string, quoteEndIdx: number): number {
  for (let i = quoteEndIdx - 1; i >= 0; i--) {
    if (text[i] === '"' && (i === 0 || text[i - 1] !== "\\")) {
      return i;
    }
  }
  return 0;
}

export function classifyTruncation(rawText: string): TruncationClassification {
  if (!rawText || rawText.trim().length === 0) {
    return "prefix_too_broken";
  }

  const state = scanJsonState(rawText);
  const trimmed = rawText.trimEnd();

  // Dangling comma: needs continuation to supply the next value/key
  if (trimmed.endsWith(",")) {
    return "continuation_needed";
  }

  // Trailing colon: needs continuation to supply a value
  const lastNonWs = getLastNonWhitespace(rawText, rawText.length);
  if (lastNonWs === ":") {
    return "continuation_needed";
  }

  if (state.openString) {
    const closeTest = tryCloseString(rawText);
    if (closeTest) {
      return "tail_closable";
    }
    return "continuation_needed";
  }

  if (state.stack.length === 0) {
    return "tail_closable";
  }

  // Check if stack is closable with only `}` and `]`
  if (stackIsClosable(state.stack)) {
    return "tail_closable";
  }

  return "continuation_needed";
}

function stackIsClosable(stack: BracketState["stack"]): boolean {
  if (stack.length === 0) return false;

  for (const item of stack) {
    // String markers mean we need more than just closers
    if (item === '"' || item === "string") {
      return false;
    }
  }

  return true;
}

function tryCloseString(rawText: string): string | null {
  const alternatives = [rawText + '"'];

  for (const candidate of alternatives) {
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // continue
    }
  }
  return null;
}

export function tryDeterministicTailClosure(rawText: string): string | null {
  const state = scanJsonState(rawText);

  if (state.openString) {
    const closed = tryCloseString(rawText);
    if (closed) {
      return closed;
    }
    return null;
  }

  if (state.stack.length === 0) {
    return null;
  }

  if (!stackIsClosable(state.stack)) {
    return null;
  }

  // Build syntax-only suffix from stack
  const reversed = [...state.stack].reverse();
  let suffix = "";
  for (const item of reversed) {
    if (item === "{") {
      suffix += "}";
    } else if (item === "[") {
      suffix += "]";
    } else {
      return null;
    }
  }

  // Reject any suffix that contains non-syntax content
  if (suffix === "") return null;

  const candidate = rawText + suffix;
  try {
    JSON.parse(candidate);
    return candidate;
  } catch {
    return null;
  }
}

export function deriveOpenPath(state: BracketState): string | null {
  return state.lastPath;
}

export function deriveRequiredRemainingPaths(
  schemaRequiredPaths: string[],
  completedPrefix: string | null,
): string[] {
  if (!completedPrefix) return schemaRequiredPaths;

  const remaining = schemaRequiredPaths.filter((path) => {
    return !completedPrefix.includes(`"${path.split(".").pop()}"`);
  });

  return remaining;
}
