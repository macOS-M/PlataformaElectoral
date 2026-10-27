import "server-only";
import { createHmac, randomBytes } from "node:crypto";
export function identifierHash(value: string) {
  const secret = process.env.AUTH_IDENTIFIER_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("Identificación sin configurar");
  return createHmac("sha256", secret).update(value).digest("hex");
}
export function activationCode() {
  return randomBytes(18).toString("base64url");
}
export function activationHash(value: string) {
  return identifierHash("activation:" + value);
}
export function registrationConfigured() {
  return (
    !!process.env.SUPABASE_SECRET_KEY &&
    (process.env.AUTH_IDENTIFIER_SECRET?.length ?? 0) >= 32
  );
}
