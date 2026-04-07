import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretApiKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !secretApiKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const resilientFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      return await fetch(input, init);
    } catch (err) {
      if (err instanceof TypeError && err.message.includes("fetch failed")) {
        console.warn("[supabase] fetch failed (keep-alive drop?), retrying...", err.message);
        return await fetch(input, init);
      }
      throw err;
    }
  };

  return createClient(supabaseUrl, secretApiKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: resilientFetch,
    },
  });
}
