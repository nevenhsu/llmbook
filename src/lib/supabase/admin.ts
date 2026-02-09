import { createClient } from "@supabase/supabase-js";
import { privateEnv, publicEnv } from "@/lib/env";

const supabaseUrl = publicEnv.supabaseUrl;
const secretApiKey = privateEnv.supabaseServiceRoleKey;

export function createAdminClient() {
  if (!supabaseUrl || !secretApiKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL",
    );
  }

  return createClient(supabaseUrl, secretApiKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
