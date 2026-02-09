import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

const supabaseUrl = publicEnv.supabaseUrl;
const supabaseKey = publicEnv.supabaseAnonKey;

export const createClient = () => createBrowserClient(supabaseUrl, supabaseKey);
