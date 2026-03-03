import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

type ProviderSecretRow = {
  provider_key: string;
  encrypted_api_key: string;
  iv: string;
  auth_tag: string;
  key_last4: string | null;
  updated_at: string;
};

const ENV_FALLBACK_UPDATED_AT = "1970-01-01T00:00:00.000Z";
const PROVIDER_KEY_ENV_VAR_MAP = {
  xai: "XAI_API_KEY",
  minimax: "MINIMAX_API_KEY",
} as const;

export type DecryptedProviderSecret = {
  providerKey: string;
  apiKey: string;
  keyLast4: string | null;
  updatedAt: string;
};

function normalizeApiKey(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const normalized = raw.trim().replace(/^['"]|['"]$/g, "");
  return normalized.length > 0 ? normalized : null;
}

function readEnvProviderApiKey(providerKey: string): string | null {
  const envName =
    PROVIDER_KEY_ENV_VAR_MAP[providerKey as keyof typeof PROVIDER_KEY_ENV_VAR_MAP] ?? null;
  if (!envName) {
    return null;
  }
  return normalizeApiKey(process.env[envName]);
}

function buildEnvProviderSecret(providerKey: string): DecryptedProviderSecret | null {
  const apiKey = readEnvProviderApiKey(providerKey);
  if (!apiKey) {
    return null;
  }
  return {
    providerKey,
    apiKey,
    keyLast4: apiKey.slice(-4),
    updatedAt: ENV_FALLBACK_UPDATED_AT,
  };
}

function readEncryptionKey(): Buffer {
  const raw = process.env.AI_PROVIDER_SECRET_ENCRYPTION_KEY ?? "";
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("MISSING_AI_PROVIDER_SECRET_ENCRYPTION_KEY");
  }

  try {
    const base64 = Buffer.from(trimmed, "base64");
    if (base64.length === 32) {
      return base64;
    }
  } catch {
    // no-op
  }

  return crypto.createHash("sha256").update(trimmed).digest();
}

function encryptApiKey(apiKey: string): {
  encryptedApiKey: string;
  iv: string;
  authTag: string;
  keyLast4: string;
} {
  const key = readEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedApiKey: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    keyLast4: apiKey.slice(-4),
  };
}

function decryptApiKey(row: ProviderSecretRow): string {
  const key = readEncryptionKey();
  const iv = Buffer.from(row.iv, "base64");
  const authTag = Buffer.from(row.auth_tag, "base64");
  const encrypted = Buffer.from(row.encrypted_api_key, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8").trim();
}

let cache: {
  expiresAt: number;
  map: Map<string, DecryptedProviderSecret>;
} | null = null;

function invalidateCache() {
  cache = null;
}

function isMissingSecretsTableError(error: { message?: unknown } | null): boolean {
  const message = typeof error?.message === "string" ? error.message : "";
  return (
    message.includes("Could not find the table 'public.ai_provider_secrets'") ||
    message.includes('relation "public.ai_provider_secrets" does not exist')
  );
}

export async function upsertProviderSecret(input: {
  providerKey: string;
  apiKey: string;
}): Promise<{ keyLast4: string }> {
  const providerKey = input.providerKey.trim();
  const apiKey = input.apiKey.trim().replace(/^['"]|['"]$/g, "");
  if (!providerKey) {
    throw new Error("providerKey is required");
  }
  if (!apiKey) {
    throw new Error("apiKey is required");
  }

  const encrypted = encryptApiKey(apiKey);
  const supabase = createAdminClient();
  const { error } = await supabase.from("ai_provider_secrets").upsert(
    {
      provider_key: providerKey,
      encrypted_api_key: encrypted.encryptedApiKey,
      iv: encrypted.iv,
      auth_tag: encrypted.authTag,
      key_last4: encrypted.keyLast4,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "provider_key" },
  );

  if (error) {
    if (isMissingSecretsTableError(error)) {
      throw new Error(
        "ai_provider_secrets table is missing. Run latest Supabase migrations first.",
      );
    }
    throw new Error(`upsert provider secret failed: ${error.message}`);
  }

  invalidateCache();
  return {
    keyLast4: encrypted.keyLast4,
  };
}

export async function listProviderSecretStatuses(providerKeys: string[]): Promise<
  Map<
    string,
    {
      hasKey: boolean;
      keyLast4: string | null;
      updatedAt: string;
    }
  >
> {
  const keys = Array.from(new Set(providerKeys.map((item) => item.trim()).filter(Boolean)));
  if (keys.length === 0) {
    return new Map();
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ai_provider_secrets")
    .select("provider_key, key_last4, updated_at")
    .in("provider_key", keys);

  const map = new Map<
    string,
    {
      hasKey: boolean;
      keyLast4: string | null;
      updatedAt: string;
    }
  >();
  if (error) {
    if (!isMissingSecretsTableError(error)) {
      throw new Error(`list provider secret statuses failed: ${error.message}`);
    }
  } else {
    for (const row of (data ?? []) as Array<{
      provider_key?: unknown;
      key_last4?: unknown;
      updated_at?: unknown;
    }>) {
      const providerKey = typeof row.provider_key === "string" ? row.provider_key.trim() : "";
      if (!providerKey) {
        continue;
      }
      map.set(providerKey, {
        hasKey: true,
        keyLast4: typeof row.key_last4 === "string" ? row.key_last4 : null,
        updatedAt: typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString(),
      });
    }
  }

  for (const key of keys) {
    if (map.has(key)) {
      continue;
    }
    const envSecret = buildEnvProviderSecret(key);
    if (!envSecret) {
      continue;
    }
    map.set(key, {
      hasKey: true,
      keyLast4: envSecret.keyLast4,
      updatedAt: envSecret.updatedAt,
    });
  }
  return map;
}

function readSecretsFromCache(providerKeys: string[]): Map<string, DecryptedProviderSecret> | null {
  const now = Date.now();
  if (!cache || cache.expiresAt <= now) {
    return null;
  }

  const subset = new Map<string, DecryptedProviderSecret>();
  for (const key of providerKeys) {
    const fromCache = cache.map.get(key);
    if (fromCache) {
      subset.set(key, fromCache);
      continue;
    }
    const fromEnv = buildEnvProviderSecret(key);
    if (fromEnv) {
      subset.set(key, fromEnv);
    }
  }

  return subset.size === providerKeys.length ? subset : null;
}

function applyEnvFallbackSecrets(
  keys: string[],
  map: Map<string, DecryptedProviderSecret>,
): Map<string, DecryptedProviderSecret> {
  for (const key of keys) {
    if (map.has(key)) {
      continue;
    }
    const envSecret = buildEnvProviderSecret(key);
    if (!envSecret) {
      continue;
    }
    map.set(key, envSecret);
  }
  return map;
}

export async function loadDecryptedProviderSecrets(
  providerKeys: string[],
): Promise<Map<string, DecryptedProviderSecret>> {
  const keys = Array.from(new Set(providerKeys.map((item) => item.trim()).filter(Boolean)));
  if (keys.length === 0) {
    return new Map();
  }

  const fromCache = readSecretsFromCache(keys);
  if (fromCache) {
    return fromCache;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ai_provider_secrets")
    .select("provider_key, encrypted_api_key, iv, auth_tag, key_last4, updated_at")
    .in("provider_key", keys);

  if (error) {
    if (isMissingSecretsTableError(error)) {
      return applyEnvFallbackSecrets(keys, new Map());
    }
    throw new Error(`load provider secrets failed: ${error.message}`);
  }

  const result = new Map<string, DecryptedProviderSecret>();
  for (const row of (data ?? []) as ProviderSecretRow[]) {
    const providerKey = row.provider_key?.trim();
    if (!providerKey) {
      continue;
    }
    let apiKey: string;
    try {
      apiKey = decryptApiKey(row);
    } catch {
      continue;
    }
    if (!apiKey) {
      continue;
    }
    result.set(providerKey, {
      providerKey,
      apiKey,
      keyLast4: row.key_last4,
      updatedAt: row.updated_at,
    });
  }

  applyEnvFallbackSecrets(keys, result);

  const now = Date.now();
  cache = {
    expiresAt: now + 60_000,
    map: result,
  };

  return result;
}
