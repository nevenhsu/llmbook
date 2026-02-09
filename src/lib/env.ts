// Only for node environment

import dotenv from "dotenv";
import { resolve } from "path";

// Load env files in priority order
// .env.local overrides .env
dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

/**
 * Centralized environment configuration
 *
 * Priority: .env.local > .env
 *
 * Public env vars (NEXT_PUBLIC_*): Can be used in browser
 * Private env vars: Server-side only
 */

// Helper to get env var with optional default
function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

// Helper to get optional env var
function getOptionalEnv(key: string): string | undefined {
  return process.env[key];
}

// ============================================
// Public Environment Variables (Browser-safe)
// These start with NEXT_PUBLIC_ and are available in client-side code
// ============================================
export const publicEnv = {
  /** Supabase URL - used by both client and server */
  supabaseUrl: getEnv("NEXT_PUBLIC_SUPABASE_URL"),

  /** Supabase Anonymous/Publishable Key - safe for browser */
  supabaseAnonKey: getEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),

  /** Application URL for callbacks and redirects */
  appUrl: getOptionalEnv("NEXT_PUBLIC_APP_URL") || "http://localhost:3000",
} as const;

// ============================================
// Private Environment Variables (Server-only)
// These should NEVER be exposed to the browser
// ============================================
export const privateEnv = {
  /** Supabase Service Role Key - ADMIN access, NEVER expose to browser */
  supabaseServiceRoleKey: getEnv("SUPABASE_SERVICE_ROLE_KEY"),

  /** Storage bucket name for media uploads */
  storageBucket: getEnv("SUPABASE_STORAGE_BUCKET"),

  // Test environment variables (only required for integration tests)
  testUserEmail: getOptionalEnv("TEST_USER_EMAIL"),
  testUserPassword: getOptionalEnv("TEST_USER_PASSWORD"),
} as const;

// ============================================
// Type definitions for env validation
// ============================================
export type PublicEnv = typeof publicEnv;
export type PrivateEnv = typeof privateEnv;

// ============================================
// Validation helpers for test files
// ============================================
export function validatePublicEnv(): void {
  const missing: string[] = [];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  if (missing.length > 0) {
    throw new Error(`Missing required public env vars: ${missing.join(", ")}`);
  }
}

export function validatePrivateEnv(): void {
  const missing: string[] = [];

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!process.env.SUPABASE_STORAGE_BUCKET) {
    missing.push("SUPABASE_STORAGE_BUCKET");
  }

  if (missing.length > 0) {
    throw new Error(`Missing required private env vars: ${missing.join(", ")}`);
  }
}

export function validateTestEnv(): void {
  validatePublicEnv();
  validatePrivateEnv();

  const missing: string[] = [];

  if (!process.env.TEST_USER_EMAIL) {
    missing.push("TEST_USER_EMAIL");
  }
  if (!process.env.TEST_USER_PASSWORD) {
    missing.push("TEST_USER_PASSWORD");
  }

  if (missing.length > 0) {
    throw new Error(`Missing required test env vars: ${missing.join(", ")}`);
  }
}

// ============================================
// Convenience exports
// ============================================

/** Check if running in integration test mode */
export const isIntegrationTest = process.env.RUN_INTEGRATION === "1";

/** Node environment */
export const nodeEnv = process.env.NODE_ENV || "development";

/** Is production build */
export const isProduction = nodeEnv === "production";

/** Is development mode */
export const isDevelopment = nodeEnv === "development";
