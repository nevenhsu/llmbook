import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretApiKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !secretApiKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, secretApiKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
