/**
 * Username Validation Library
 *
 * Rules (Instagram-style):
 * - Only letters (a-z, A-Z), numbers (0-9), periods (.), and underscores (_)
 * - Cannot start or end with a period
 * - Cannot have consecutive periods (..)
 * - Length: 3-20 characters
 * - User accounts: Cannot start with 'ai_'
 * - Persona accounts: Must start with 'ai_'
 */

export interface UsernameValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate username format
 * NOTE: Input should already be trimmed and lowercased before calling this function
 */
export function validateUsernameFormat(
  username: string,
  isPersona: boolean = false,
): UsernameValidationResult {
  // Check if empty
  if (!username || username === "") {
    return { valid: false, error: "Username 不能為空" };
  }

  // Check length (3-20 chars)
  if (username.length < 3 || username.length > 20) {
    return { valid: false, error: "Username 長度必須在 3-20 字元之間" };
  }

  // Check allowed characters (letters, numbers, period, underscore)
  const allowedCharsPattern = /^[a-z0-9_.]+$/;
  if (!allowedCharsPattern.test(username)) {
    return { valid: false, error: "只能使用英文字母、數字、句點 (.) 和底線 (_)" };
  }

  // Check cannot start with period
  if (username.startsWith(".")) {
    return { valid: false, error: "Username 不能以句點開頭" };
  }

  // Check cannot end with period
  if (username.endsWith(".")) {
    return { valid: false, error: "Username 不能以句點結尾" };
  }

  // Check no consecutive periods
  if (username.includes("..")) {
    return { valid: false, error: "Username 不能包含連續的句點" };
  }

  // Persona-specific validation
  if (isPersona) {
    if (!username.startsWith("ai_")) {
      return { valid: false, error: "AI Persona 的 username 必須以 ai_ 開頭" };
    }
  } else {
    // User-specific validation: cannot start with 'ai_'
    if (username.startsWith("ai_")) {
      return { valid: false, error: "Username 不能以 ai_ 開頭（此前綴保留給 AI Persona）" };
    }
  }

  return { valid: true };
}

/**
 * Sanitize username (remove invalid characters, convert to lowercase)
 */
export function sanitizeUsername(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, "") // Remove invalid characters
    .replace(/^\.+/, "") // Remove leading periods
    .replace(/\.+$/, "") // Remove trailing periods
    .replace(/\.{2,}/g, ".") // Replace consecutive periods with single period
    .substring(0, 20); // Limit to 20 chars
}

/**
 * Client-side username availability check
 */
export async function checkUsernameAvailability(username: string): Promise<{
  available: boolean;
  error?: string;
}> {
  try {
    const response = await fetch("/api/username/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });

    if (!response.ok) {
      return { available: false, error: "無法檢查 username 可用性" };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    return { available: false, error: "網路錯誤" };
  }
}

/**
 * Get username validation rules as array (for UI display)
 */
export function getUsernameRules(isPersona: boolean = false): string[] {
  const rules = [
    "長度 3-20 字元",
    "只能使用英文字母、數字、句點 (.) 和底線 (_)",
    "不能以句點開頭或結尾",
    "不能包含連續的句點",
  ];

  if (isPersona) {
    rules.push("必須以 ai_ 開頭");
  } else {
    rules.push("不能以 ai_ 開頭（此前綴保留給 AI）");
  }

  return rules;
}
