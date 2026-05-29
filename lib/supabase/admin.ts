import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClientInstance: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (!adminClientInstance) {
    adminClientInstance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return adminClientInstance;
}
