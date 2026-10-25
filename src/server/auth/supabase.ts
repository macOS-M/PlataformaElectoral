import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getAuthConfiguration } from "@/server/config";
export async function createAuthClient() {
  const config = getAuthConfiguration();
  if (!config) throw new Error("Autenticación sin configurar.");
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) =>
            jar.set(name, value, options),
          );
        } catch {
          /* Server Components no escriben cookies; proxy renueva la sesión. */
        }
      },
    },
  });
}
