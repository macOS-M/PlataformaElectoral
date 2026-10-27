import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getAuthConfiguration } from "@/server/config";
export function createAdminAuthClient() {
  const config = getAuthConfiguration();
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!config || !key) throw new Error("Registro sin configurar");
  return createClient(config.url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
