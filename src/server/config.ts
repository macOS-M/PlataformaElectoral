import "server-only";
import { z } from "zod";
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//),
  APP_ORGANIZATION_ID: z.uuid(),
  APP_CANTON_ID: z.uuid(),
  APP_EVENT_ID: z.uuid(),
});
export function getConfiguration() {
  const parsed = schema.safeParse(process.env);
  return parsed.success ? parsed.data : null;
}
export function getAuthConfiguration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key && z.url().safeParse(url).success ? { url, key } : null;
}
