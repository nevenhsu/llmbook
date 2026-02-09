import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";

const supabaseUrl = publicEnv.supabaseUrl;
const supabaseKey = publicEnv.supabaseAnonKey;

type CookieStore = Awaited<ReturnType<typeof cookies>>;

export async function createClient(
  cookieStore: CookieStore | Promise<CookieStore> = cookies(),
) {
  const resolvedStore = await cookieStore;

  return createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() {
        return resolvedStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            resolvedStore.set(name, value, options),
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
}
