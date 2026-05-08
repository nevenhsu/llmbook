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
          // This was a string value after a key
        } else if (top === '"') {
          stack.pop();
          // This was a key, next should be ':'
          // Skip whitespace to check for ':'
          let j = i + 1;
          while (j < rawText.length && /\s/.test(rawText[j])) j++;
          if (j < rawText.length && rawText[j] === ":") {
            // This was a key - record it
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
        // Determine if this is a key or value based on context
        // If the last non-whitespace was '{' or ',' -> it's a key
        // If the last non-whitespace was ':' -> it's a value
        const prev = getLastNonWhitespace(rawText, i);
        if (prev === "{" || prev === ",") {
          stack.push('"'); // key
        } else if (prev === ":" || prev === "[" || prev === null) {
          stack.push("string"); // value
        } else {
          // Default: treat as value
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
        // If this array is a value of a key, don't reset path
        break;
      case "}":
        if (stack[stack.length - 1] === "{") {
          stack.pop();
          depth--;
          // Navigate up one level in path
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
  // Go backwards from the closing quote to find the opening quote
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

  if (state.openString) {
    const closeTest = tryCloseString(rawText);
    if (closeTest) {
      return "tail_closable";
    }
    return "prefix_too_broken";
  }

  if (state.stack.length === 0) {
    if (trimmed.endsWith(",")) {
      return "continuation_needed";
    }
    return "tail_closable";
  }

  const closable = stackIsClosable(state.stack);
  if (closable && !trimmed.endsWith(",")) {
    return "tail_closable";
  }

  if (trimmed.endsWith(",")) {
    return "continuation_needed";
  }

  return "continuation_needed";
}

function stackIsClosable(stack: BracketState["stack"]): boolean {
  if (stack.length === 0) return false;

  // We can close arrays and objects, but not broken strings
  for (const item of stack) {
    if (item === '"' || item === "string") {
      return false;
    }
  }

  return true;
}

function tryCloseString(rawText: string): string | null {
  const alternatives = [rawText + '"', rawText + '\\"'];

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
    // No open stack - nothing to close
    return null;
  }

  // Build suffix from stack
  const suffix = reverseStack(state.stack);
  if (!suffix) return null;

  const candidate = rawText + suffix;
  try {
    JSON.parse(candidate);
    return candidate;
  } catch {
    // Try a few more suffix candidates
    const alternatives = buildSuffixAlternatives(state.stack);
    for (const alt of alternatives) {
      try {
        JSON.parse(rawText + alt);
        return rawText + alt;
      } catch {
        // continue
      }
    }
    return null;
  }
}

function reverseStack(stack: BracketState["stack"]): string | null {
  const reversed = [...stack].reverse();
  let suffix = "";
  for (const item of reversed) {
    if (item === "{" || item === '"' || item === "string") {
      suffix += "}";
    } else if (item === "[") {
      suffix += "]";
    } else {
      return null;
    }
  }
  return suffix;
}

function buildSuffixAlternatives(stack: BracketState["stack"]): string[] {
  const reversed = [...stack].reverse();
  const results: string[] = [];
  const suffixes: string[] = [];

  for (const item of reversed) {
    if (item === "{" || item === '"' || item === "string") {
      suffixes.push("}");
    } else if (item === "[") {
      suffixes.push("]");
    }
  }

  if (suffixes.length === 2) {
    results.push(suffixes.join(""));
    results.push('"",\n  ' + suffixes.join(""));
  } else if (suffixes.length === 1) {
    results.push(suffixes[0]);
  } else {
    results.push(suffixes.join(""));
  }

  return results;
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
