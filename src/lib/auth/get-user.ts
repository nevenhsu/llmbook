import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

/**
 * Cached user getter for server components
 * Uses React cache() to deduplicate getUser calls within a single request
 * Safe for server-side use - cache is scoped to single request lifecycle
 */
export const getUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
