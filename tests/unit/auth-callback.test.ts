import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ config: vi.fn(), exchange: vi.fn() }));
vi.mock("@/server/config", () => ({ getConfiguration: mocks.config }));
vi.mock("@/server/auth/supabase", () => ({ createAuthClient: async () => ({ auth: { exchangeCodeForSession: mocks.exchange } }) }));
import { GET } from "@/app/auth/callback/route";
beforeEach(() => { vi.resetAllMocks(); mocks.config.mockReturnValue({}); });
it.each([["recovery", "/restablecer-contrasena"], [null, "/resumen"]])("redirige tipo %s solo a destino interno %s", async (redirectType, path) => {
  mocks.exchange.mockResolvedValue({ data: { redirectType }, error: null });
  const r = await GET(new NextRequest("http://localhost/auth/callback?code=synthetic&next=https://evil.invalid"));
  expect(r.headers.get("location")).toBe(`http://localhost${path}`);
  expect(r.headers.get("cache-control")).toBe("private, no-store");
  expect(r.headers.get("referrer-policy")).toBe("no-referrer");
});
it("rechaza códigos inválidos sin abrir la página de cambio", async () => {
  mocks.exchange.mockResolvedValue({ data: {}, error: new Error("expired") });
  const r = await GET(new NextRequest("http://localhost/auth/callback?code=synthetic"));
  expect(r.headers.get("location")).toBe("http://localhost/iniciar-sesion?error=callback");
});
