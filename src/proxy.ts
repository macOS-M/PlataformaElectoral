import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getConfiguration } from "@/server/config";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (request.nextUrl.pathname === "/" || request.nextUrl.pathname === "/servicios" || request.nextUrl.pathname === "/servicios/transporte" || request.nextUrl.pathname.startsWith("/servicios/transporte/")) {
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  const config = getConfiguration();
  if (!config) return response;
  const url = config.NEXT_PUBLIC_SUPABASE_URL;
  const key = config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  // Valida/renueva tokens; cada servicio vuelve a comprobar usuario y membresía.
  await supabase.auth.getUser();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
