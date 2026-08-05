import { createBrowserClient } from "@supabase/ssr";
import { requirePublicSupabaseEnv } from "@/lib/env";
import type { Database } from "@/types/database";

export function createClient() {
  const { url, anonKey } = requirePublicSupabaseEnv();
  return createBrowserClient<Database>(url, anonKey);
}
