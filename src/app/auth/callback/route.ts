import { NextResponse, type NextRequest } from "next/server";
import { createAuthClient } from "@/server/auth/supabase";
import { getConfiguration } from "@/server/config";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code && getConfiguration()) {
    const client = await createAuthClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/resumen", request.url));
  }
  return NextResponse.redirect(
    new URL("/iniciar-sesion?error=callback", request.url),
  );
}
