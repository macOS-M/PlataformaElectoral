import { NextResponse, type NextRequest } from "next/server";
import { createAuthClient } from "@/server/auth/supabase";
import { getConfiguration } from "@/server/config";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code && getConfiguration()) {
    const client = await createAuthClient();
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (!error) {
      // El SDK instalado devuelve redirectType en ejecución; su tipo público
      // AuthTokenResponse no lo declara. Comprobar presencia antes de utilizarlo.
      const isRecovery = "redirectType" in data && data.redirectType === "recovery";
      const destination = isRecovery ? "/restablecer-contrasena" : "/resumen";
      const response = NextResponse.redirect(new URL(destination, request.url));
      response.headers.set("Cache-Control", "private, no-store");
      response.headers.set("Referrer-Policy", "no-referrer");
      return response;
    }
  }
  return NextResponse.redirect(
    new URL("/iniciar-sesion?error=callback", request.url),
  );
}
