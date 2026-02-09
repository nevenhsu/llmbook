import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

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
