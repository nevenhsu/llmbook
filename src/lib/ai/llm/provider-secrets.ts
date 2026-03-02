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

export type DecryptedProviderSecret = {
  providerKey: string;
  apiKey: string;
  keyLast4: string | null;
  updatedAt: string;
};

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

  if (error) {
    if (isMissingSecretsTableError(error)) {
      return new Map();
    }
    throw new Error(`list provider secret statuses failed: ${error.message}`);
  }

  const map = new Map<
    string,
    {
      hasKey: boolean;
      keyLast4: string | null;
      updatedAt: string;
    }
  >();
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
  return map;
}

export async function loadDecryptedProviderSecrets(
  providerKeys: string[],
): Promise<Map<string, DecryptedProviderSecret>> {
  const keys = Array.from(new Set(providerKeys.map((item) => item.trim()).filter(Boolean)));
  if (keys.length === 0) {
    return new Map();
  }

  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    const subset = new Map<string, DecryptedProviderSecret>();
    for (const key of keys) {
      const item = cache.map.get(key);
      if (item) {
        subset.set(key, item);
      }
    }
    if (subset.size === keys.length) {
      return subset;
    }
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ai_provider_secrets")
    .select("provider_key, encrypted_api_key, iv, auth_tag, key_last4, updated_at")
    .in("provider_key", keys);

  if (error) {
    if (isMissingSecretsTableError(error)) {
      return new Map();
    }
    throw new Error(`load provider secrets failed: ${error.message}`);
  }

  const result = new Map<string, DecryptedProviderSecret>();
  for (const row of (data ?? []) as ProviderSecretRow[]) {
    const providerKey = row.provider_key?.trim();
    if (!providerKey) {
      continue;
    }
    const apiKey = decryptApiKey(row);
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

  cache = {
    expiresAt: now + 60_000,
    map: result,
  };

  return result;
}
